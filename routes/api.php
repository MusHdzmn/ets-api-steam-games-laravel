<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\StatsController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['message' => 'Steam Store Games API']));

// Autentikasi (publik)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Baca data (publik)
Route::get('/games', [GameController::class, 'index']);
Route::get('/games/search', [GameController::class, 'search']);
Route::get('/games/top', [GameController::class, 'top']);
Route::get('/games/{appid}', [GameController::class, 'show'])->whereNumber('appid');
Route::get('/stats/genre', [StatsController::class, 'genre']);
Route::get('/stats/year', [StatsController::class, 'year']);

// Perlu token JWT
Route::middleware('auth:api')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Tulis data: token JWT + API key
    Route::middleware('apikey')->group(function () {
        Route::post('/games', [GameController::class, 'store']);
        Route::put('/games/{appid}', [GameController::class, 'update'])->whereNumber('appid');
        Route::delete('/games/{appid}', [GameController::class, 'destroy'])->whereNumber('appid');
    });
});