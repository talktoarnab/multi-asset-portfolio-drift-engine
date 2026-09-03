# The state bucket had to exist before any remote-state apply could run, so it
# was created with the AWS CLI. These blocks adopt it into state.
#
# Delete this file once the first bootstrap apply has succeeded; re-running it
# against already-managed resources fails.

import {
  to = aws_s3_bucket.tfstate
  id = "portfolio-drift-engine-tfstate-523115032266"
}

import {
  to = aws_s3_bucket_versioning.tfstate
  id = "portfolio-drift-engine-tfstate-523115032266"
}

import {
  to = aws_s3_bucket_server_side_encryption_configuration.tfstate
  id = "portfolio-drift-engine-tfstate-523115032266"
}

import {
  to = aws_s3_bucket_public_access_block.tfstate
  id = "portfolio-drift-engine-tfstate-523115032266"
}
