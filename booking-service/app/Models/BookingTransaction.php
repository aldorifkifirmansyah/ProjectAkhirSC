<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingTransaction extends Model
{
    use HasFactory;

    protected $table = 'booking_transactions';

    protected $fillable = [
        'user_id',
        'vehicle_id',
        'booking_code',
        'start_date',
        'end_date',
        'total_days',
        'total_price',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];
}
