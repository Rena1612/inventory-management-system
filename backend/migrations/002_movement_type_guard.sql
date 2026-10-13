-- Guards the ledger against the application's type set drifting from the database.
--
-- `stock_movements.type` is already the `movement_type` enum, so an arbitrary
-- string cannot be stored today. This constraint is here for the day someone runs
-- `ALTER TYPE movement_type ADD VALUE`: Postgres would happily accept the new
-- label while the application has no sign rule for it, and DELTA_SQL in
-- movement_service.py would silently report a positive delta for a movement that
-- actually removes stock.
--
-- Adding a movement type is therefore a two-step change on purpose:
--   1. add the label to the enum,
--   2. teach DELTA_SQL and stock_movements_sign_by_type about it.
-- Until step 2 happens, writes for the new type fail here instead of corrupting
-- the ledger.
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_known
  CHECK (type IN ('in', 'out', 'adjust', 'transfer_in', 'transfer_out'));