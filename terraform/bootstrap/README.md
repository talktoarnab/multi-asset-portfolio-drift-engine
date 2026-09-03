# Bootstrap

Infrastructure the CI pipeline cannot manage for itself:

- the S3 bucket holding remote state for both this stack and the application stack
- the IAM policy granting the GitHub Actions deploy user (`lamba-cli-access`) its DynamoDB, EventBridge, and remote-state permissions

Kept separate from `terraform/` because a pipeline identity that manages its own
permissions can escalate to full account access if its credentials leak, and
because IAM propagation delays make self-granting applies fail intermittently.

## Running it

Requires **admin credentials** — the deploy user cannot grant itself these
permissions. Run from this directory with an admin profile:

```bash
cd terraform/bootstrap
AWS_PROFILE=<your-admin-profile> terraform init
AWS_PROFILE=<your-admin-profile> terraform plan
AWS_PROFILE=<your-admin-profile> terraform apply
```

The first `plan` reports four imports, two resources to add, and one in-place
update (tagging the imported bucket). The imports adopt the state bucket, which
was created with the AWS CLI before any remote-state apply was possible.

## After the first apply

Delete `imports.tf`. Import blocks fail once their targets are already in
state, so leaving the file in place breaks every later plan.

## Applying it again

Only when the application stack starts using a new AWS service — add the
matching actions to `deploy_permissions.tf` and re-apply with admin
credentials. Routine application changes go through the pipeline instead.

`prevent_destroy` guards the state bucket: `terraform destroy` will refuse
until you remove that lifecycle block, which is deliberate. Destroying the
bucket would discard the record of every deployed resource.
