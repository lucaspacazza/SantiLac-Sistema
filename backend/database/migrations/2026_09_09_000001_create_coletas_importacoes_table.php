<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CONNECTION = 'raw';

    public function up(): void
    {
        $schema = Schema::connection(self::CONNECTION);
        if ($schema->hasTable('coletas_importacoes')) {
            return;
        }

        $schema->create('coletas_importacoes', function (Blueprint $table): void {
            $table->id();
            $table->string('arquivo_nome');
            $table->string('arquivo_caminho');
            $table->char('arquivo_hash', 64)->unique();
            $table->unsignedInteger('registros_lidos')->default(0);
            $table->unsignedInteger('registros_criados')->default(0);
            $table->unsignedInteger('registros_ignorados')->default(0);
            $table->decimal('litros_lidos', 15, 3)->default(0);
            $table->json('resumo')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection(self::CONNECTION)->dropIfExists('coletas_importacoes');
    }
};
