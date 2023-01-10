import * as cdk from "aws-cdk-lib";
import * as path from "path";
import api = require("aws-cdk-lib/aws-apigateway");
import cwlogs = require("aws-cdk-lib/aws-logs");
import iam = require("aws-cdk-lib/aws-iam");
import event_sources = require("aws-cdk-lib/aws-lambda-event-sources");
import lambda = require("aws-cdk-lib/aws-lambda");
import s3 = require("aws-cdk-lib/aws-s3");
import ssm = require("aws-cdk-lib/aws-ssm");
import { Construct } from "constructs";

const batchJobName = "ml-serverless-job";
const inputBucketName = "ml-serverless-bucket";
const prefix = "MLServerlessStack";

interface LambdaResourcesProps extends cdk.NestedStackProps {
  batchJobSubmitterPolicy: iam.PolicyStatement;
  batchLambdaParam: ssm.StringListParameter;
}

export class LambdaResources extends cdk.NestedStack {
  bucket: s3.Bucket;
  lambdaEcrCleanupParam: ssm.StringParameter;
  lambdaAppUrl: cdk.CfnOutput;
  httpApiUrl: cdk.CfnOutput;
  inputBucketOutput: cdk.CfnOutput;
  inputBucketName: cdk.CfnOutput;
  rltInfFn: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, inputBucketName, {
      bucketName: inputBucketName + `-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, //<==FOR DEMO ONLY===
      autoDeleteObjects: true, // <==DEMO ONLY - NOT RECOMMENDED IN PRODUCTION===
    });

    this.inputBucketOutput = new cdk.CfnOutput(
      this,
      `${prefix}-input-bucket-output`,
      {
        value: `https://s3.console.aws.amazon.com/s3/buckets/${this.bucket.bucketName}?region=${cdk.Aws.REGION}&tab=objects`,
      }
    );

    this.inputBucketName = new cdk.CfnOutput(
      this,
      `${prefix}-input-bucket-name`,
      {
        value: this.bucket.bucketName,
      }
    );

    // =====================================================================================
    // Building our native real-time inference AWS Lambda Function
    // =====================================================================================

    const sciPyMXNetLayer = new lambda.LayerVersion(
      this,
      `${prefix}-mxnet-layer`,
      {
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../src/lambda_fn/realtime_inf/layers/mxnet.zip"
          )
        ),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
      }
    );

    const RealtimeFn = new lambda.Function(this, `${prefix}-realtime-Fn`, {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../src/lambda_fn/realtime_inf/realtime_fn")
      ),
      handler: "index.lambda_handler",
      layers: [sciPyMXNetLayer],
      memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
    });

    const apiRole = new iam.Role(this, "APIRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    apiRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [RealtimeFn.functionArn],
      })
    );

    // =====================================================================================
    // Building our AWS Batch Job Submitter AWS Lambda Function
    // =====================================================================================

    const batchJobDef = cdk.Fn.select(
      0,
      props.batchLambdaParam.stringListValue
    );
    const batchJobQ = cdk.Fn.select(1, props.batchLambdaParam.stringListValue);

    const batchJobSubmitter = new lambda.Function(this, "batchJobSubmitterFn", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../src/lambda_fn/batch_jobs_submitter")
      ),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      environment: {
        ["JOB_NAME"]: batchJobName,
        ["JOB_QUEUE"]: batchJobQ,
        ["JOB_DEFINITION"]: batchJobDef,
      },
    });

    batchJobSubmitter.addEventSource(
      new event_sources.S3EventSource(this.bucket, {
        events: [
          s3.EventType.OBJECT_CREATED_PUT,
          s3.EventType.OBJECT_CREATED_POST,
        ],
        filters: [{ prefix: "input/" }],
      })
    );
    this.bucket.grantRead(batchJobSubmitter);

    batchJobSubmitter.addToRolePolicy(props.batchJobSubmitterPolicy);

    // =====================================================================================
    // Building our API Gateway
    // =====================================================================================
    const predictInteration = new api.LambdaIntegration(RealtimeFn, {
      integrationResponses: [{ statusCode: "200" }],
      requestTemplates: { ["application/jpeg"]: `{"content": "$input.body"}` },
      contentHandling: api.ContentHandling.CONVERT_TO_TEXT,
      passthroughBehavior: api.PassthroughBehavior.WHEN_NO_TEMPLATES,
      proxy: false,
    });
    const apiLog = new cwlogs.LogGroup(this, `${prefix}-api-logs`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: cwlogs.RetentionDays.ONE_MONTH,
      logGroupName: `${prefix}-realtime-api`,
    });

    const predictApi = new api.RestApi(this, `${prefix}-predict-api`, {
      binaryMediaTypes: ["application/jpeg"],
      endpointTypes: [api.EndpointType.REGIONAL],
      deployOptions: {
        loggingLevel: api.MethodLoggingLevel.ERROR,
        accessLogDestination: new api.LogGroupLogDestination(apiLog),
        accessLogFormat: api.AccessLogFormat.jsonWithStandardFields(),
      },
      cloudWatchRole: true,
    });
    const resource = predictApi.root.addResource("predict");
    resource.addMethod("POST", predictInteration, {
      methodResponses: [
        {
          statusCode: "200",
          responseModels: { ["application/json"]: api.Model.EMPTY_MODEL },
        },
      ],
    });

    this.httpApiUrl = new cdk.CfnOutput(this, "httpApiUrl", {
      value: `${predictApi.url}`,
    });

    this.lambdaAppUrl = new cdk.CfnOutput(this, "LambdaAppURL", {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/lambda/home?region=${cdk.Aws.REGION}#/applications/${this.stackName}`,
    });
  }
}
