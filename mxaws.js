const AWS   = require("aws-sdk");
const nconf = require("nconf");

const awsId     = nconf.env().get("awsAccessKeyId");
const awsKey    = nconf.env().get("awsSecretAccessKey");
const awsRegion = nconf.env().get("awsRegion");

if (!(awsId && awsKey && awsRegion)){
    console.log("AWS Credential Environment Variables are missing or malformed.");
    console.log(`Please ensure that "awsAccessKeyId", "awsSecretAccessKey", and "awsRegion"`);
    console.log("are defined correctly wherever you define your environment variables.");
    console.log("Exiting.");
    process.exit(1);
}

const AWSConfig = new AWS.Config({
    accessKeyId: awsId,
    secretAccessKey: awsKey,
    region: awsRegion
});

const EC2 = new AWS.EC2(AWSConfig);
const RDS = new AWS.RDS(AWSConfig);
const CodeDeploy = new AWS.CodeDeploy(AWSConfig);

exports.mxaws = class mxaws {

    static delay(secs){return new Promise((resolve) => setTimeout(resolve, secs*1000));}

    static waitForEC2InstanceArrayShutdown(ec2InstanceIdArray){
        return EC2.waitFor("instanceStopped",{"InstanceIds":ec2InstanceIdArray}).promise();
    }

    static waitForEC2InstanceArrayStartup(ec2InstanceIdArray){
        return EC2.waitFor("instanceRunning",{"InstanceIds":ec2InstanceIdArray}).promise();
    }

    //TODO: There may be a bug here due to an possible extremely recent change in the API
    static waitForRDSInstanceAvailable(identifier){
        //yes you read that right. dB. little d big B.
        return RDS.waitFor("dBInstanceAvailable",{"DBInstanceIdentifier":identifier}).promise();
    }

    static getEC2InstancesByEnvironment(environmentNameArray){
        if (!environmentNameArray       ||
            !environmentNameArray[0]    ||
             environmentNameArray[0] == "")
            return this.getEC2Instances();
        const params = {
            "Filters":[
                {
                    "Name":"tag-key",
                    "Values":["Environment"]
                },{
                    "Name":"tag-value",
                    "Values":environmentNameArray
                }
            ]
        };
        return EC2.describeInstances(params).promise();
    }

    static getEC2InstanceByName(instanceName){
        if (!instanceName || instanceName == "")
            return this.getEC2Instances();
        const params = {
            "Filters":[
                {
                    "Name":"tag-key",
                    "Values":["Name"]
                },{
                    "Name":"tag-value",
                    "Values":[instanceName]
                }
            ]
        };
        return EC2.describeInstances(params).promise();
    }

    static getEC2Instances(){return EC2.describeInstances().promise();}

    static startEC2InstancesByInstanceIdArray(instanceIds){
        return EC2.startInstances({"InstanceIds":instanceIds}).promise();
    }

    static stopEC2InstancesByInstanceIdArray(instanceIds){
        return EC2.stopInstances({"InstanceIds":instanceIds}).promise();
    }

    static rebootEC2InstancesByInstanceIdArray(instanceIds){
        return EC2.rebootInstances({"InstanceIds":instanceIds}).promise();
    }

    //have to handle RDS 1 at a time apparently
    static resizeRDSInstance(identifier, size){
        var params = {
            "DBInstanceIdentifier":identifier,
            "DBInstanceClass":size,
            "ApplyImmediately":true
        };
        return RDS.modifyDBInstance(params).promise();
    }

    static getRDSInstances() {
        return RDS.describeDBInstances({}).promise();
    }

    static getRDSInstance(identifier) {
        if (!identifier || identifier == "" || identifier == true) return this.getRDSInstances();
        return RDS.describeDBInstances({"DBInstanceIdentifier":identifier}).promise();
    }

    static rebootRDSInstance(identifier){
        return RDS.rebootDBInstance({"DBInstanceIdentifier":identifier}).promise();
    }

    static async resizeEC2Instance(instanceId, size){

        const powerParams = {"InstanceIds": [instanceId]};
        const sizeParams = {
            "InstanceId":instanceId,
            "InstanceType":{"Value":size}
        };

        const instanceData = await EC2.describeInstances(powerParams).promise();
        const instanceWasRunning = instanceData.Reservations[0].Instances[0].State.Name == "running";

        if (instanceWasRunning) await EC2.stopInstances(powerParams).promise();
        await this.waitForEC2InstanceArrayShutdown([instanceId]);
        await EC2.modifyInstanceAttribute(sizeParams).promise();

        if (!instanceWasRunning) return;
        await EC2.startInstances(powerParams).promise();
        await this.waitForEC2InstanceArrayStartup([instanceId]);
    }

    static async resizeEC2InstancesByInstanceIdArray(instanceIdArray, size){
        let promiseArray =
            instanceIdArray.map(instanceId => this.resizeEC2Instance(instanceId, size));

        return Promise.all(promiseArray);
    }

    static async statusEC2(targetName, isEnvironment){
        if (Array.isArray(targetName))
            return await Promise.all(targetName.map(name => this.statusEC2(name, isEnvironment)));

        const data = (isEnvironment
            ? await this.getEC2InstancesByEnvironment([targetName])
            : await this.getEC2InstanceByName(targetName))
                .Reservations.map(res => res.Instances[0]);

        const activeInstances = data.filter(datum => datum.State.Name != "terminated");

        return activeInstances.map(inst => {
            let instName = inst.Tags.filter(tag => tag.Key == "Name")[0].Value;
            let instApp = inst.Tags.filter(tag => tag.Key == "Application")[0].Value;
            let instEnv = inst.Tags.filter(tag => tag.Key == "Environment")[0].Value;
            return {
                InstanceName:       instName,
                InstanceState:      inst.State.Name,
                InstanceApplication:(instApp ? instApp : "db"),
                InstanceEnvironment:instEnv,
                InstanceAddress:    inst.PublicIpAddress,
                InstanceSize:       inst.InstanceType,
                InstanceId:         inst.InstanceId
            };
        });
    };

    static async statusRDS(targetDB){

        if (Array.isArray(targetDB))
            return await Promise.all(targetDB.map(db => statusRDS(db)));

        const data = (await this.getRDSInstance(targetDB));
        const dbs = data.DBInstances;
        return dbs.map(db => {
            return {
                InstanceName:       db.DBInstanceIdentifier,
                InstanceState:      db.DBInstanceStatus,
                InstanceAddress:    db.Endpoint.Address,
                InstanceSize:       db.DBInstanceClass,
            };
        });
    };
};

exports.mxCodeDeploy = class mxCodeDeploy {

    static getDeploymentGroupData(appName, groupName){
        const getGroupParams = {
            applicationName: appName,
            deploymentGroupName: groupName
        };
        return CodeDeploy.getDeploymentGroup(getGroupParams).promise();
    };

    static updateDeploymentGroupFilter(appName, groupName, ec2TagFilterArray){
        const updateGroupCallParams = {
            applicationName: appName,
            currentDeploymentGroupName: groupName,
            ec2TagFilters: ec2TagFilterArray,
        };
        return CodeDeploy.updateDeploymentGroup(updateGroupCallParams).promise();
    };

    static async deployDeploymentGroup(appName, groupName, deploymentRevision){
        const deployParams = {
            applicationName: appName,
            deploymentGroupName: groupName,
            revision:  deploymentRevision
        };
        console.log(`Starting deployment of ${appName} to ${groupName}...`);
        return await CodeDeploy.createDeployment(deployParams).promise();
        // console.log(`Starting deployment of ${appName} to ${groupName}...`);
        // await CodeDeploy.waitFor("deploymentSuccessful", deployment).promise()
        // .catch(err => console.log(err));
        // return deployment;
    };

    static waitForDeploymentSuccessfulAndGetAnyErrors(deployment){
        return CodeDeploy.waitFor("deploymentSuccessful", deployment).promise()
        .catch(async err => {

            const listInstData =
                await CodeDeploy.listDeploymentInstances(deployment).promise();

            const getDepInstancesParams =
                Object.assign({instanceIds: listInstData.instancesList}, deployment);

            const info = await CodeDeploy.batchGetDeploymentInstances(getDepInstancesParams).promise();
            console.log(info.instancesSummary[0].lifecycleEvents);
        });
    }

}

return exports;
