# Test fixtures

All fixtures use the controlled `demo_fixture` source.

## Sequence

1. `baseline.csv`  
   Six active listings.

2. `followup_1.csv`  
   - demo-001 price/rating/review change;
   - demo-002 first direct not-found;
   - demo-004 search-only absence;
   - demo-005 source error;
   - demo-006 direct website added;
   - demo-007 new listing.

3. `followup_2.csv`  
   - demo-002 second qualifying not-found after 48 hours, expected suspected inactive;
   - demo-004 active again without prior inactivity;
   - demo-005 healthy active, source error did not count as miss.

4. `followup_3.csv`  
   - demo-002 third qualifying not-found across more than seven days, expected confirmed inactive.

5. `reactivated.csv`  
   Targeted direct observation run for demo-002, not a full-market snapshot. Expected reactivated.

6. `invalid_rows.csv`  
   Validation failures.

## Important

`reactivated.csv` must be imported with coverage mode `targeted_listing_check`. It must not be compared as a full coverage run, otherwise its intentionally small row count would look like coverage collapse.
