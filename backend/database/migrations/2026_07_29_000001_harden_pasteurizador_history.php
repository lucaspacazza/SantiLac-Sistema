<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CONNECTION = 'raw';

    private const COLLECTIONS_TABLE = 'pasteurizador_coletas';

    private const SAMPLES_TABLE = 'pasteurizador_amostras';

    private const INGESTION_KEY_UNIQUE = 'uq_pasteurizador_coletas_ingestion_key';

    private const TIMESTAMP_CHANNEL_INDEX = 'idx_pasteurizador_amostras_timestamp_canal_id';

    private const CHANNEL_TIMESTAMP_INDEX = 'idx_pasteurizador_amostras_canal_timestamp_id';

    public function up(): void
    {
        $schema = Schema::connection(self::CONNECTION);

        if ($schema->hasTable(self::COLLECTIONS_TABLE)) {
            $this->addCollectionMetadataColumns();
            $this->addIngestionKeyUniqueIndex();
        }

        if ($schema->hasTable(self::SAMPLES_TABLE)) {
            $this->addSampleQueryIndexes();
        }
    }

    public function down(): void
    {
        $schema = Schema::connection(self::CONNECTION);

        if ($schema->hasTable(self::SAMPLES_TABLE)) {
            $dropTimestampChannel = $this->indexExists(
                self::SAMPLES_TABLE,
                self::TIMESTAMP_CHANNEL_INDEX
            );
            $dropChannelTimestamp = $this->indexExists(
                self::SAMPLES_TABLE,
                self::CHANNEL_TIMESTAMP_INDEX
            );

            if ($dropTimestampChannel || $dropChannelTimestamp) {
                $schema->table(self::SAMPLES_TABLE, function (Blueprint $table) use (
                    $dropTimestampChannel,
                    $dropChannelTimestamp
                ): void {
                    if ($dropTimestampChannel) {
                        $table->dropIndex(self::TIMESTAMP_CHANNEL_INDEX);
                    }
                    if ($dropChannelTimestamp) {
                        $table->dropIndex(self::CHANNEL_TIMESTAMP_INDEX);
                    }
                });
            }
        }

        if (! $schema->hasTable(self::COLLECTIONS_TABLE)) {
            return;
        }

        if ($this->indexExists(self::COLLECTIONS_TABLE, self::INGESTION_KEY_UNIQUE)) {
            $schema->table(self::COLLECTIONS_TABLE, function (Blueprint $table): void {
                $table->dropUnique(self::INGESTION_KEY_UNIQUE);
            });
        }

        $columns = array_values(array_filter(
            ['ingestion_key', 'period_start', 'period_end', 'raw_sha256'],
            fn (string $column): bool => $schema->hasColumn(self::COLLECTIONS_TABLE, $column)
        ));

        if ($columns !== []) {
            $schema->table(self::COLLECTIONS_TABLE, function (Blueprint $table) use ($columns): void {
                $table->dropColumn($columns);
            });
        }
    }

    private function addCollectionMetadataColumns(): void
    {
        $schema = Schema::connection(self::CONNECTION);
        $addIngestionKey = ! $schema->hasColumn(self::COLLECTIONS_TABLE, 'ingestion_key');
        $addPeriodStart = ! $schema->hasColumn(self::COLLECTIONS_TABLE, 'period_start');
        $addPeriodEnd = ! $schema->hasColumn(self::COLLECTIONS_TABLE, 'period_end');
        $addRawSha256 = ! $schema->hasColumn(self::COLLECTIONS_TABLE, 'raw_sha256');

        if (! $addIngestionKey && ! $addPeriodStart && ! $addPeriodEnd && ! $addRawSha256) {
            return;
        }

        $schema->table(self::COLLECTIONS_TABLE, function (Blueprint $table) use (
            $addIngestionKey,
            $addPeriodStart,
            $addPeriodEnd,
            $addRawSha256
        ): void {
            if ($addIngestionKey) {
                $table->char('ingestion_key', 64)->nullable();
            }
            if ($addPeriodStart) {
                $table->dateTime('period_start')->nullable();
            }
            if ($addPeriodEnd) {
                $table->dateTime('period_end')->nullable();
            }
            if ($addRawSha256) {
                $table->char('raw_sha256', 64)->nullable();
            }
        });
    }

    private function addIngestionKeyUniqueIndex(): void
    {
        if ($this->indexExists(self::COLLECTIONS_TABLE, self::INGESTION_KEY_UNIQUE)) {
            return;
        }

        $this->normalizeDuplicateIngestionKeys();

        Schema::connection(self::CONNECTION)
            ->table(self::COLLECTIONS_TABLE, function (Blueprint $table): void {
                $table->unique('ingestion_key', self::INGESTION_KEY_UNIQUE);
            });
    }

    private function normalizeDuplicateIngestionKeys(): void
    {
        $database = DB::connection(self::CONNECTION);
        $database->table(self::COLLECTIONS_TABLE)
            ->whereNotNull('ingestion_key')
            ->whereRaw("TRIM(ingestion_key) = ''")
            ->update(['ingestion_key' => null]);

        $duplicates = $database->table(self::COLLECTIONS_TABLE)
            ->select('ingestion_key')
            ->whereNotNull('ingestion_key')
            ->groupBy('ingestion_key')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('ingestion_key');

        foreach ($duplicates as $ingestionKey) {
            $keepId = $database->table(self::COLLECTIONS_TABLE)
                ->where('ingestion_key', $ingestionKey)
                ->orderBy('id')
                ->value('id');

            if ($keepId === null) {
                continue;
            }

            $database->table(self::COLLECTIONS_TABLE)
                ->where('ingestion_key', $ingestionKey)
                ->where('id', '<>', $keepId)
                ->update(['ingestion_key' => null]);
        }
    }

    private function addSampleQueryIndexes(): void
    {
        $schema = Schema::connection(self::CONNECTION);
        $addTimestampChannel = ! $this->indexExists(
            self::SAMPLES_TABLE,
            self::TIMESTAMP_CHANNEL_INDEX
        );
        $addChannelTimestamp = ! $this->indexExists(
            self::SAMPLES_TABLE,
            self::CHANNEL_TIMESTAMP_INDEX
        );

        if (! $addTimestampChannel && ! $addChannelTimestamp) {
            return;
        }

        $schema->table(self::SAMPLES_TABLE, function (Blueprint $table) use (
            $addTimestampChannel,
            $addChannelTimestamp
        ): void {
            if ($addTimestampChannel) {
                $table->index(
                    ['timestamp_registro', 'canal', 'id'],
                    self::TIMESTAMP_CHANNEL_INDEX
                );
            }
            if ($addChannelTimestamp) {
                $table->index(
                    ['canal', 'timestamp_registro', 'id'],
                    self::CHANNEL_TIMESTAMP_INDEX
                );
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        foreach (Schema::connection(self::CONNECTION)->getIndexes($table) as $index) {
            $existingName = $index['name'] ?? null;
            if (is_string($existingName) && strcasecmp($existingName, $indexName) === 0) {
                return true;
            }
        }

        return false;
    }
};
