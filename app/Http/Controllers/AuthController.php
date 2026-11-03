<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use PHPOpenSourceSaver\JWTAuth\JWTGuard;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'detail' => 'Validasi gagal',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Password otomatis di-hash oleh cast 'hashed' di model User.
        // Jangan di-hash lagi di sini, nanti login selalu gagal.
        $user = User::create($validator->validated());

        return response()->json([
            'detail' => 'Registrasi berhasil',
            'user'   => $user,
        ], 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'detail' => 'Validasi gagal',
                'errors' => $validator->errors(),
            ], 422);
        }

        $token = $this->guard()->attempt($validator->validated());

        if (! $token) {
            return response()->json([
                'detail' => 'Email atau password salah',
            ], 401);
        }

        return $this->respondWithToken($token);
    }

    public function me()
    {
        return response()->json($this->guard()->user());
    }

    public function refresh()
    {
        return $this->respondWithToken($this->guard()->refresh());
    }

    public function logout()
    {
        $this->guard()->logout();

        return response()->json([
            'detail' => 'Berhasil logout, token tidak berlaku lagi',
        ]);
    }

    private function respondWithToken(string $token)
    {
        return response()->json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'expires_in'   => $this->guard()->factory()->getTTL() * 60,
        ]);
    }

    /**
     * Guard 'api' (driver jwt). Catatan tipe ini hanya untuk editor,
     * supaya fungsi attempt, refresh, logout, dan factory dikenali.
     *
     * @return JWTGuard
     */
    private function guard()
    {
        return auth('api');
    }
}