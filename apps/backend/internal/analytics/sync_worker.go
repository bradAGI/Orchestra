package analytics

import (
	"context"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/rs/zerolog"
)

// SyncConfig holds configuration for the external analytics sync worker.
type SyncConfig struct {
	AnthropicAdminKey string
	OpenAIAdminKey    string
	SyncInterval      time.Duration
	Enabled           bool
}

// RunSyncWorker starts a background loop that periodically syncs external usage
// and cost data from configured provider admin APIs. It blocks until ctx is
// cancelled. If cfg.Enabled is false, it returns immediately.
//
// The returned channel can be used to trigger a manual sync (send any value).
func RunSyncWorker(ctx context.Context, warehouseDB *db.DB, cfg SyncConfig, logger zerolog.Logger) chan struct{} {
	triggerCh := make(chan struct{}, 1)

	if !cfg.Enabled {
		logger.Info().Msg("external analytics sync disabled")
		return triggerCh
	}

	interval := cfg.SyncInterval
	if interval <= 0 {
		interval = time.Hour
	}

	go func() {
		logger.Info().Dur("interval", interval).Msg("starting external analytics sync worker")

		// Run an initial sync immediately.
		syncAll(ctx, warehouseDB, cfg, logger)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				logger.Info().Msg("external analytics sync worker stopped")
				return
			case <-ticker.C:
				syncAll(ctx, warehouseDB, cfg, logger)
			case <-triggerCh:
				syncAll(ctx, warehouseDB, cfg, logger)
			}
		}
	}()

	return triggerCh
}

// syncAll performs a full sync of usage and cost data for all configured
// providers, covering the last 7 days.
func syncAll(ctx context.Context, warehouseDB *db.DB, cfg SyncConfig, logger zerolog.Logger) {
	now := time.Now().UTC()
	since := now.AddDate(0, 0, -7)
	until := now

	if cfg.AnthropicAdminKey != "" {
		syncAnthropic(ctx, warehouseDB, cfg.AnthropicAdminKey, since, until, logger)
	}
	if cfg.OpenAIAdminKey != "" {
		syncOpenAI(ctx, warehouseDB, cfg.OpenAIAdminKey, since, until, logger)
	}
}

func syncAnthropic(ctx context.Context, warehouseDB *db.DB, key string, since, until time.Time, logger zerolog.Logger) {
	syncer := NewAnthropicSyncer(key)
	ll := logger.With().Str("provider", "anthropic").Logger()

	usage, err := syncer.SyncUsage(ctx, since, until)
	if err != nil {
		ll.Error().Err(err).Msg("failed to sync anthropic usage")
	} else {
		for _, u := range usage {
			if err := warehouseDB.UpsertExternalUsage(ctx, u); err != nil {
				ll.Error().Err(err).Str("id", u.ID).Msg("failed to upsert anthropic usage")
			}
		}
		ll.Info().Int("records", len(usage)).Msg("synced anthropic usage")
	}

	costs, err := syncer.SyncCost(ctx, since, until)
	if err != nil {
		ll.Error().Err(err).Msg("failed to sync anthropic costs")
	} else {
		for _, c := range costs {
			if err := warehouseDB.UpsertExternalUsage(ctx, c); err != nil {
				ll.Error().Err(err).Str("id", c.ID).Msg("failed to upsert anthropic cost")
			}
		}
		ll.Info().Int("records", len(costs)).Msg("synced anthropic costs")
	}
}

func syncOpenAI(ctx context.Context, warehouseDB *db.DB, key string, since, until time.Time, logger zerolog.Logger) {
	syncer := NewOpenAISyncer(key)
	ll := logger.With().Str("provider", "openai").Logger()

	usage, err := syncer.SyncUsage(ctx, since, until)
	if err != nil {
		ll.Error().Err(err).Msg("failed to sync openai usage")
	} else {
		for _, u := range usage {
			if err := warehouseDB.UpsertExternalUsage(ctx, u); err != nil {
				ll.Error().Err(err).Str("id", u.ID).Msg("failed to upsert openai usage")
			}
		}
		ll.Info().Int("records", len(usage)).Msg("synced openai usage")
	}

	costs, err := syncer.SyncCost(ctx, since, until)
	if err != nil {
		ll.Error().Err(err).Msg("failed to sync openai costs")
	} else {
		for _, c := range costs {
			if err := warehouseDB.UpsertExternalUsage(ctx, c); err != nil {
				ll.Error().Err(err).Str("id", c.ID).Msg("failed to upsert openai cost")
			}
		}
		ll.Info().Int("records", len(costs)).Msg("synced openai costs")
	}
}
