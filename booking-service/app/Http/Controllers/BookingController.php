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
                'status' => 'pending'
            ]);

            // 6. Update status kendaraan di Catalog Service menjadi 'booked' via PATCH
            Http::patch(env('CATALOG_SERVICE_URL') . '/vehicles/' . $request->vehicle_id . '/status', [
                'status' => 'booked'
            ]);

            // 7. Kirim notifikasi ke Notification Service
            Http::post(env('NOTIFICATION_SERVICE_URL') . '/notifications', [
                'booking_code' => $booking->booking_code,
                'user_id'      => $booking->user_id,
                'vehicle_id'   => $booking->vehicle_id,
                'total_price'  => $booking->total_price,
            ]);

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
        $bookings = BookingTransaction::where('user_id', $user->id)->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ], 200);
    }
}
