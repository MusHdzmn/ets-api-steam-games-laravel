<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.api_key');
        $given = (string) $request->header('X-API-KEY', '');

        if ($expected === '' || ! hash_equals($expected, $given)) {
            return response()->json([
                'detail' => 'API key tidak valid. Sertakan header X-API-KEY.',
            ], 401);
        }

        return $next($request);
    }
}