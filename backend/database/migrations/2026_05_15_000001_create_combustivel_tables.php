<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('combustivel_estoques', function (Blueprint $table): void {
            $table->id();
            $table->string('tanque', 80)->default('interno');
            $table->decimal('capacidade_litros', 10, 3)->default(3000);
            $table->decimal('estoque_atual_litros', 10, 3)->default(0);
            $table->unsignedBigInteger('usuario_id')->nullable()->index();
            $table->timestamps();

            $table->unique('tanque');
        });

        DB::table('combustivel_estoques')->insert([
            'tanque' => 'interno',
            'capacidade_litros' => 3000,
            'estoque_atual_litros' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::create('combustivel_movimentacoes', function (Blueprint $table): void {
            $table->id();
            $table->string('tipo', 20);
            $table->decimal('quantidade_litros', 10, 3);
            $table->string('motorista_nome', 160)->nullable();
            $table->string('caminhao_nome', 160)->nullable();
            $table->string('placa', 20)->nullable();
            $table->unsignedInteger('km')->nullable();
            $table->text('observacao')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable()->index();
            $table->timestamps();

            $table->index(['tipo', 'created_at']);
            $table->index('motorista_nome');
            $table->index('caminhao_nome');
        });

        Schema::create('combustivel_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('acao', 80);
            $table->text('descricao');
            $table->unsignedBigInteger('movimentacao_id')->nullable()->index();
            $table->unsignedBigInteger('usuario_id')->nullable()->index();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['acao', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('combustivel_logs');
        Schema::dropIfExists('combustivel_movimentacoes');
        Schema::dropIfExists('combustivel_estoques');
    }
};
