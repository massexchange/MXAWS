#     MXAWS
#### Basic Work-In-Progress wrapper/programmatic auto-authenticator for AWS functionlity using the AWS JS SDK in Nodejs.

This code is a work in progress, but will be maintained to be as stable as possible, considering that many, many things internally already depend on it.

NOTE: this is currently NOT compatible with browser-side JS -- totally down to entertain it in the future.

### How to use

1.) Install via npm:
```bash
npm install -s massexchange/mxaws
```

2.) - Provide the following as environment variables. Depending on your OS, this would be done as `export` statements in your `~/.bashrc`, `~/.zshrc` or `profile`, or inside administrative settings in Windows.:
    - `awsAccessKeyId`: the ID of the aws credential.
    - `awsSecretAccessKey`: the credential's key
    - `awsRegion`: the aws region being operated on.

3.) Require it. NOTE: At the point of being "required" is when the aforementioned environment variables are read. If they are missing, mxaws will defer to any IAM roles or other avenues of automatic configuration, as described in the JS AWS-SDK docs.

```js
const {mxaws} = require("mxaws"); //For EC2 and RDS functionality, as of Sept 7.
                                  //There is an internal JIRA issue for segregating them
const {mxCodeDeploy} = require("mxaws"); //For some light CodeDeploy functionality.
```

4.) Start issuing aws calls! This libary is definitely still a work in progress, but will be growing rapidly. I'd document further, but the code itself is made to be as simple as possible. If you need to know what functionality this exposes currently, read **mxaws.js**. At the time of writing, it handles a lot of EC2 and RDS state operations, like shutoffs, resizes, waits, status checks, and power-ons. As of
Sept 7, 2017, also can be used to trigger CodeDeploy deployments, as well as
collecting errors in said deployments.
