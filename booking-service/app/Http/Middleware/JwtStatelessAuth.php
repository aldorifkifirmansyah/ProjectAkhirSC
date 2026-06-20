<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Symfony\Component\HttpFoundation\Response;

class JwtStatelessAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            // 1. Cek dan dekripsi token JWT yang masuk di header Bearer
            if (! $userPayload = JWTAuth::parseToken()->getPayload()) {
                return response()->json(['success' => false, 'message' => 'User not found in token'], 401);
            }

            // 2. Ambil data user tiruan dari isi payload token (id dan role)
            $user = new \App\Models\User();
            $user->id = $userPayload->get('sub');
            $user->role = $userPayload->get('role');

            // 3. Suntikkan object user ini ke dalam sistem autentikasi Laravel saat ini
            auth()->setUser($user);

        } catch (\PHPOpenSourceSaver\JWTAuth\Exceptions\TokenExpiredException $e) {
            return response()->json(['success' => false, 'message' => 'Token has expired'], 401);
        } catch (\PHPOpenSourceSaver\JWTAuth\Exceptions\TokenInvalidException $e) {
            return response()->json(['success' => false, 'message' => 'Token is invalid'], 401);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Authorization token not found'], 401);
        }

        return $next($request);
    }
}
