<?php

use App\Http\Controllers\BookingController;
use Illuminate\Support\Facades\Route;

Route::middleware('jwt.stateless')->group(function () {
    Route::post('/bookings',                    [BookingController::class, 'create']);
    Route::get('/bookings/my',                  [BookingController::class, 'myBookings']);
    Route::get('/bookings',                     [BookingController::class, 'allBookings']);
    Route::patch('/bookings/{id}/cancel',       [BookingController::class, 'cancel']);
    Route::patch('/bookings/{id}/complete',     [BookingController::class, 'complete']);
});
