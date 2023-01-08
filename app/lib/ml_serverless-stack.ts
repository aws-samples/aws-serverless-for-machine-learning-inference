import * as cdk from "aws-cdk-lib";
import * as path from "path";
import cr = require("aws-cdk-lib/custom-resources");
import lambda = require("aws-cdk-lib/aws-lambda");
import logs = require("aws-cdk-lib/aws-logs");
import { Construct } from "constructs";
import { BaseResources } from "./base-resources";
import { LambdaResources } from "./lambda-resources";
import { BatchResources } from "./batch-resources";

const prefix = "MLServerlessStack";

export class MLServerlessStack extends cdk.Stack {
  baseResources: BaseResources;
  lambdaResources: LambdaResources;
  batchResources: BatchResources;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.baseResources = new BaseResources(this, `${prefix}-base`);
    const { vpc, batchSg } = this.baseResources;

    this.batchResources = new BatchResources(this, `${prefix}-batch`, {
      vpc,
      batchSg,
    });

    const {
      batchEcrCleanupParam,
      batchLambdaParam,
      batchJobSubmitterPolicy,
      ecrCleanUpRole,
      ecrPolicy,
    } = this.batchResources;

    this.lambdaResources = new LambdaResources(this, `${prefix}-lambdas`, {
      batchJobSubmitterPolicy,
      batchLambdaParam,
    });
    const { lambdaAppUrl, httpApiUrl, inputBucketOutput, inputBucketName } =
      this.lambdaResources;

    // =====================================================================================
    // ECR repos cleanup on stack deletion
    // =====================================================================================

    const onEvent = new lambda.Function(this, `${prefix}-ecr-cleanup`, {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../src/lambda_fn/ecr_cleanup")
      ),
      handler: "index.on_event",
      runtime: lambda.Runtime.PYTHON_3_7,
      timeout: cdk.Duration.seconds(60),
      memorySize: 128,
    });

    onEvent.addToRolePolicy(ecrPolicy);

    const customResourceProvider = new cr.Provider(
      this,
      `${prefix}-cr-provider`,
      {
        onEventHandler: onEvent,
        logRetention: logs.RetentionDays.ONE_MONTH,
        role: ecrCleanUpRole,
      }
    );

    const batchImageRepo = batchEcrCleanupParam.stringValue;

    const cleanBatchEcrRepo = new cdk.CustomResource(
      this,
      `${prefix}-ecr-batch-repo-cleanup`,
      {
        serviceToken: customResourceProvider.serviceToken,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        properties: {
          ["Repository"]: batchImageRepo,
          ["PhysicalResourceId"]: cr.PhysicalResourceId.of(batchImageRepo),
        },
      }
    );

    const region = cdk.Aws.REGION;
    const acctId = cdk.Aws.ACCOUNT_ID;

    let names = [
      "batch-dashboard-console-url",
      "ecr-console-batch",
      "lambda-app-console-url",
      "input-bucket-s3-console.url",
      "input-bucket-name-output",
      "httpApi-url",
      "curl-example",
      "batch-inf-aws-cli",
    ];
    let values = [
      `https://${region}.console.aws.amazon.com/batch/home?region=${region}#dashboard`,
      `https://${region}.console.aws.amazon.com/ecr/repositories/private/${acctId}/${batchImageRepo}?region=${region}`,
      lambdaAppUrl.value,
      inputBucketOutput.value,
      inputBucketName.value,
      httpApiUrl.value,
      `curl -v -H "Content-Type: application/jpeg" --data-binary @<your jpeg file name> ${httpApiUrl.value}predict`,
      `aws s3 cp </path/to/jpeg file name/> s3://${inputBucketName.value}/input/`,
    ];
    let descriptions = [
      "Batch Dashboard",
      "Batch ECR Console URL",
      "Lambda App URL",
      "Input Bucket S3 Console URL",
      "S3 Input Bucket Name",
      "API URL",
      "Curl Command example to test realtime inference",
      "AWS CLI example to test batch inference",
    ];

    names.forEach((element, index) => {
      new cdk.CfnOutput(this, element, {
        value: values[index],
        description: descriptions[index],
      });
    });
  }
}
