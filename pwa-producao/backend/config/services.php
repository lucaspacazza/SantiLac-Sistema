<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'processor' => [
        'url' => env('PROCESSOR_HTTP_URL'),
        'token' => env('PROCESSOR_TOKEN'),
    ],

    'pasteurizador' => [
        'processor_url' => env('PASTEURIZADOR_PROCESSOR_URL', 'http://192.168.0.203:8095'),
    ],

    'santilac' => [
        'api_key' => env('SANTILAC_API_KEY'),
    ],

    'produtor_app' => [
        'version_code' => (int) env('APP_PRODUTOR_VERSION_CODE', 1),
        'version_name' => env('APP_PRODUTOR_VERSION_NAME', '0.1.0'),
        'apk_url' => env('APP_PRODUTOR_APK_URL'),
        'update_required' => filter_var(env('APP_PRODUTOR_UPDATE_REQUIRED', false), FILTER_VALIDATE_BOOLEAN),
        'update_message' => env('APP_PRODUTOR_UPDATE_MESSAGE', 'Nova versão disponível.'),
    ],

];
