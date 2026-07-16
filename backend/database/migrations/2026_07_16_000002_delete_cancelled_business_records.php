<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('raw');
        $database = DB::connection('raw');

        $database->transaction(function () use ($schema, $database): void {
            if ($schema->hasTable('ordens_producao')) {
                if ($schema->hasTable('producao_formulacoes_queijo') && $schema->hasColumn('producao_formulacoes_queijo', 'ordem_producao_id')) {
                    $cancelledOrderIds = $database->table('ordens_producao')
                        ->where('status', 'cancelada')
                        ->pluck('id');

                    if ($cancelledOrderIds->isNotEmpty()) {
                        $database->table('producao_formulacoes_queijo')
                            ->whereIn('ordem_producao_id', $cancelledOrderIds)
                            ->update(['ordem_producao_id' => null]);
                    }
                }

                $database->table('ordens_producao')->where('status', 'cancelada')->delete();
            }

            foreach (['producao_formulacoes_queijo', 'producao_soro_refrigerado', 'producao_formulacoes_creme', 'producao_creme'] as $table) {
                if ($schema->hasTable($table)) {
                    $database->table($table)->where('status', 'cancelada')->delete();
                }
            }

            if ($schema->hasTable('expedicao_ordens')) {
                $cancelledShippingIds = $database->table('expedicao_ordens')
                    ->where('status', 'cancelada')
                    ->pluck('id');

                if ($cancelledShippingIds->isNotEmpty() && $schema->hasTable('expedicao_ordem_paletes')) {
                    $database->table('expedicao_ordem_paletes')
                        ->whereIn('ordem_id', $cancelledShippingIds)
                        ->delete();
                }

                $database->table('expedicao_ordens')->where('status', 'cancelada')->delete();
            }
        });
    }

    public function down(): void
    {
        // Exclusões definitivas não podem ser reconstruídas em rollback.
    }
};
