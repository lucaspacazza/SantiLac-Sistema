<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('raw');

        if (! $schema->hasColumn('producao_formulacoes_queijo', 'ordem_producao_id')) {
            $schema->table('producao_formulacoes_queijo', function (Blueprint $table): void {
                $table->unsignedBigInteger('ordem_producao_id')->nullable()->after('id');
                $table->index('ordem_producao_id', 'idx_formulacoes_queijo_ordem');
            });
        }

        if (! $schema->hasColumn('ordens_producao', 'tipo_queijo')) {
            $schema->table('ordens_producao', function (Blueprint $table): void {
                $table->string('tipo_queijo', 120)->nullable()->after('formulacao_queijo_id');
                $table->index(
                    ['data_ordem', 'tipo_queijo', 'status'],
                    'idx_ordens_producao_tipo_data'
                );
            });
        }
    }

    public function down(): void
    {
        // Migração EXPAND: as colunas permanecem para permitir rollback seguro do código.
    }
};
