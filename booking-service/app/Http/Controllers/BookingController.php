<?php

namespace App\Http\Controllers;

use App\Models\BookingTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehicle_id' => 'required|integer',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 400);
        }

        // 1. Ambil data user login dari token JWT yang dikirim
        $user = auth()->user();
        $userId = $user->id;

        // 2. Hitung total_days menggunakan Carbon
        $startDate = Carbon::parse($request->start_date);
        $endDate = Carbon::parse($request->end_date);
        $totalDays = $startDate->diffInDays($endDate);

        if ($totalDays <= 0) {
            $totalDays = 1; // Minimal 1 hari rental
        }

        // 3. Komunikasi Antar-Service: Tembak Catalog Service (Express.js) untuk ambil data kendaraan
        $catalogUrl = env('CATALOG_SERVICE_URL') . '/vehicles/' . $request->vehicle_id;

        try {
            $response = Http::get($catalogUrl);

            if ($response->failed()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vehicle not found in catalog service'
                ], 404);
            }

            $vehicleData = $response->json()['data'];

            // Validasi status ketersediaan kendaraan
            if ($vehicleData['status'] !== 'available') {
                return response()->json([
                    'success' => false,
                    'message' => 'Vehicle is already booked or unavailable'
                ], 400);
            }

            // 4. Kalkulasi Total Harga
            $pricePerDay = $vehicleData['price_per_day'];
            $totalPrice = $totalDays * $pricePerDay;

            // 5. Simpan transaksi booking ke database db_booking
            $booking = BookingTransaction::create([
                'user_id' => $userId,
                'vehicle_id' => $request->vehicle_id,
                'booking_code' => 'BK-' . strtoupper(Str::random(8)),
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'total_days' => $totalDays,
                'total_price' => $totalPrice,
                'status' => 'booked'
            ]);

            // 6. Update status kendaraan di Catalog Service menjadi 'booked' via PATCH
            Http::patch(env('CATALOG_SERVICE_URL') . '/vehicles/' . $request->vehicle_id . '/status', [
                'status' => 'booked'
            ]);

            // 7. Kirim notifikasi ke Notification Service
            try {
                Http::post('http://localhost:3002/api/notifications', [
                    'type'         => 'booking_created',
                    'message'      => 'New booking created! Booking code: ' . $booking->booking_code
                                      . ', Vehicle ID: ' . $booking->vehicle_id
                                      . ', Total: Rp ' . number_format($booking->total_price, 0, ',', '.'),
                    'status'       => 'unread',
                    'timestamp'    => now()->toISOString(),
                    'booking_code' => $booking->booking_code,
                    'user_id'      => $booking->user_id,
                    'vehicle_id'   => $booking->vehicle_id,
                    'total_days'   => $booking->total_days,
                    'total_price'  => $booking->total_price,
                ]);
            } catch (\Exception $e) {
                // Non-fatal: notification failure does not block the booking response
            }

            return response()->json([
                'success' => true,
                'message' => 'Booking created successfully',
                'data' => $booking
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to connect to Catalog Service: ' . $e->getMessage()
            ], 500);
        }
    }

    public function myBookings()
    {
        $user = auth()->user();
        $bookings = BookingTransaction::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ], 200);
    }

    public function allBookings()
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $bookings = BookingTransaction::orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ], 200);
    }

    public function cancel(Request $request, $id)
    {
        $user    = auth()->user();
        $booking = BookingTransaction::find($id);

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Booking not found'], 404);
        }

        // Customers may only cancel their own bookings; admins may cancel any
        if ($user->role !== 'admin' && $booking->user_id != $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        if (in_array($booking->status, ['cancelled', 'completed'])) {
            return response()->json([
                'success' => false,
                'message' => 'Booking is already ' . $booking->status
            ], 400);
        }

        $booking->status = 'cancelled';
        $booking->save();

        // Release vehicle back to available in catalog-service
        try {
            Http::patch(env('CATALOG_SERVICE_URL') . '/vehicles/' . $booking->vehicle_id . '/status', [
                'status' => 'available'
            ]);
        } catch (\Exception $e) {
            // Non-fatal: catalog sync failure does not block the cancel response
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking cancelled successfully',
            'data'    => $booking
        ], 200);
    }

    public function complete(Request $request, $id)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $booking = BookingTransaction::find($id);

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Booking not found'], 404);
        }

        if (in_array($booking->status, ['cancelled', 'completed'])) {
            return response()->json([
                'success' => false,
                'message' => 'Booking is already ' . $booking->status
            ], 400);
        }

        $booking->status = 'completed';
        $booking->save();

        // Release vehicle back to available in catalog-service
        try {
            Http::patch(env('CATALOG_SERVICE_URL') . '/vehicles/' . $booking->vehicle_id . '/status', [
                'status' => 'available'
            ]);
        } catch (\Exception $e) {
            // Non-fatal: catalog sync failure does not block the complete response
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking marked as completed',
            'data'    => $booking
        ], 200);
    }
}
