<?php

namespace SantiLac\Admin;

use PDO;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection) return self::$connection;
        $host = Config::get('DB_HOST', '127.0.0.1');
        $port = Config::get('DB_PORT', '3306');
        $name = Config::get('DB_DATABASE', 'santilac_raw');
        self::$connection = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            Config::get('DB_USERNAME', ''),
            Config::get('DB_PASSWORD', ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
        );
        return self::$connection;
    }
}
