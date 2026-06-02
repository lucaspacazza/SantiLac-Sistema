<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('combustivel_movimentacoes', function (Blueprint $table): void {
            if (! Schema::hasColumn('combustivel_movimentacoes', 'caminhao_nome')) {
                $table->string('caminhao_nome', 160)->nullable()->after('motorista_nome');
                $table->index('caminhao_nome');
            }

            if (! Schema::hasColumn('combustivel_movimentacoes', 'placa')) {
                $table->string('placa', 20)->nullable()->after('caminhao_nome');
            }
        });
    }

    public function down(): void
    {
        Schema::table('combustivel_movimentacoes', function (Blueprint $table): void {
            if (Schema::hasColumn('combustivel_movimentacoes', 'caminhao_nome')) {
                $table->dropIndex(['caminhao_nome']);
                $table->dropColumn('caminhao_nome');
            }

            if (Schema::hasColumn('combustivel_movimentacoes', 'placa')) {
                $table->dropColumn('placa');
            }
        });
    }
};
