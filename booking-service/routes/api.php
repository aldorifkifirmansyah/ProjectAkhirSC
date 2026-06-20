<?php

use App\Http\Controllers\BookingController;
use Illuminate\Support\Facades\Route;

Route::middleware('jwt.stateless')->group(function () {
    Route::post('/bookings', [BookingController::class, 'create']);
    Route::get('/bookings/my', [BookingController::class, 'myBookings']);
});
