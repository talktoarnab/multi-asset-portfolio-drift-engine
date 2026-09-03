# The table outlived an earlier apply that ran without remote state, so it
# exists in AWS but not in state, and CreateTable is not idempotent. This
# adopts it instead of colliding with it.
#
# Delete this file once the apply that performs the import has succeeded;
# import blocks fail against resources already tracked in state.

import {
  to = aws_dynamodb_table.portfolio_drift_engine
  id = "portfolio-drift-engine-dev"
}
