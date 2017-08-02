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

3.) Require it. NOTE: At the point of being "required" is when the aforementioned environment variables are read. If they are missing, mxaws WILL call process.exit(1), triggering a hard and immediate exit.

```js
const {mxaws} = require("mxaws");
```

4.) Start issuing aws calls! This libary is definitely still a work in progress, but will be growing rapidly. I'd document further, but the code itself is made to be as simple as possible. If you need to know what functionality this exposes currently, read **mxaws.js**. At the time of writing, it handles a lot of EC2 and RDS state operations, like shutoffs, resizes, waits, status checks, and power-ons. In the short term, there should be some CodeDeploy functionality added pretty soon -- just a matter of factoring it out of some internal code.
