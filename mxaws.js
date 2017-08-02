const AWS   = require("aws-sdk");
const nconf = require("nconf");

const awsId     = nconf.env().get("awsAccessKeyId");
const awsKey    = nconf.env().get("awsSecretAccessKey");
const awsRegion = nconf.env().get("awsRegion");

if (!(awsId && awsKey && awsRegion)){
    console.log("AWS Credential Environment Variables are missing or malformed.");
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
        let promiseArray = instanceIdArray.map(instanceId => this.resizeEC2Instance(instanceId, size));
        return Promise.all(promiseArray);
    }

};

return exports;
