import * as cdk from "aws-cdk-lib";
import * as path from "path";
import batch = require("aws-cdk-lib/aws-batch");
import ec2 = require("aws-cdk-lib/aws-ec2");
import ecr = require("aws-cdk-lib/aws-ecr");
import ecrdeploy = require("cdk-ecr-deployment");
import iam = require("aws-cdk-lib/aws-iam");
import ssm = require("aws-cdk-lib/aws-ssm");
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";

const batchImageRepoName = "batch-ecr";
const batchJobQueueName = "batch-queue";
const inputBucketName = "ml-serverless-bucket";
const prefix = "MLServerlessStack";
const inputBucketArn = `arn:aws:s3:::${inputBucketName}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;

interface BatchResourcesProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  batchSg: ec2.SecurityGroup;
}

export class BatchResources extends cdk.NestedStack {
  batchEcrCleanupParam: ssm.StringParameter;
  batchLambdaParam: ssm.StringListParameter;
  batchJobSubmitterPolicy: iam.PolicyStatement;
  ecrPolicy: iam.PolicyStatement;
  ecrCleanUpRole: iam.Role;

  constructor(scope: Construct, id: string, props: BatchResourcesProps) {
    super(scope, id, props);

    // =====================================================================================
    // Building IAM Resources for Batch inference image and pushing to ECR
    // =====================================================================================
    const batchJobRole = new iam.Role(this, "mlBlogBatchJobRole", {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        new iam.ServicePrincipal("ec2.amazonaws.com")
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2ContainerServiceforEC2Role"
        ),
      ],
    });

    const batchJobExecRole = new iam.Role(this, "mlBlogBatchExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    const compEnvSvcRole = iam.Role.fromRoleArn(
      this,
      `${prefix}-compute-role`,
      `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/batch.amazonaws.com/AWSServiceRoleForBatch`,
      { mutable: false }
    );
    const ecrCleanUpRole = new iam.Role(this, "EcrCleanUpRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // =====================================================================================
    // Building our Batch inference image and pushing to ECR
    // =====================================================================================

    const batchImageRepo = new ecr.Repository(
      this,
      `${prefix}-${batchImageRepoName}`,
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY, // <==FOR DEMO ONLY ===
        repositoryName: `${batchImageRepoName}`,
      }
    );

    const batchInfImage = new DockerImageAsset(this, `${prefix}-image`, {
      directory: path.join(__dirname, "../../src/batch_image"),
    });

    const batchImagepush = new ecrdeploy.ECRDeployment(
      this,
      `${prefix}-image-deploy`,
      {
        src: new ecrdeploy.DockerImageName(batchInfImage.imageUri),
        dest: new ecrdeploy.DockerImageName(
          `${batchImageRepo.repositoryUri}:latest`
        ),
      }
    );

    // =====================================================================================
    // Configuring AWS Batch
    // =====================================================================================

    const batchComputeEnv = new batch.CfnComputeEnvironment(
      this,
      `${prefix}-compute-env`,
      {
        computeEnvironmentName: `${prefix}-compute-env`,
        type: "MANAGED",
        state: "ENABLED",
        computeResources: {
          maxvCpus: 256,
          type: "FARGATE",
          subnets: [
            props.vpc.publicSubnets[0].subnetId,
            props.vpc.publicSubnets[1].subnetId,
          ],
          securityGroupIds: [props.batchSg.securityGroupId],
        },
        serviceRole: compEnvSvcRole.roleArn,
      }
    );

    const batchJobDef = new batch.CfnJobDefinition(this, `${prefix}-JobDef`, {
      jobDefinitionName: `${prefix}-JobDef`,
      retryStrategy: { attempts: 1 },
      type: "container",
      platformCapabilities: ["FARGATE"],
      containerProperties: {
        image: `${batchImageRepo.repositoryUri}:latest`,
        networkConfiguration: { assignPublicIp: "ENABLED" },
        resourceRequirements: [
          { type: "VCPU", value: "4" },
          { type: "MEMORY", value: "16384" },
        ],
        jobRoleArn: batchJobRole.roleArn,
        executionRoleArn: batchJobExecRole.roleArn,
        command: ["python", "batch_processor.py"],
      },
    });
    let s3Actions = ["s3:ListBucket", "s3:GetObject", "s3:PutObject"];
    batchJobRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [inputBucketArn, `${inputBucketArn}/*`],
        actions: s3Actions,
        effect: iam.Effect.ALLOW,
      })
    );

    batchJobExecRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [inputBucketArn, `${inputBucketArn}/*`],
        actions: s3Actions,
        effect: iam.Effect.ALLOW,
      })
    );

    batchJobDef.node.addDependency(batchImagepush);

    const batchJobQ = new batch.CfnJobQueue(
      this,
      `${prefix}-${batchJobQueueName}`,
      {
        computeEnvironmentOrder: [
          {
            order: 1,
            computeEnvironment: batchComputeEnv.ref,
          },
        ],
        priority: 1,
        state: "ENABLED",
        jobQueueName: batchJobQueueName,
      }
    );
    this.batchJobSubmitterPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "batch:DescribeJobQueues",
        "batch:DescribeJobs",
        "batch:DescribeJobDefinitions",
        "batch:ListJobs",
        "batch:DescribeComputeEnvironments",
        "batch:UntagResource",
        "batch:DeregisterJobDefinition",
        "batch:TerminateJob",
        "batch:CancelJob",
        "batch:ListTagsForResource",
        "batch:SubmitJob",
        "batch:RegisterJobDefinition",
        "batch:TagResource",
        "batch:UpdateJobQueue",
      ],
      resources: [
        `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job/*`,
        `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-definition/${batchJobDef.jobDefinitionName}:*`,
        `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-queue/${batchJobQ.jobQueueName}`,
        `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:compute-environment/${batchComputeEnv.computeEnvironmentName}`,
      ],
    });

    this.ecrPolicy = new iam.PolicyStatement({
      resources: [batchImageRepo.repositoryArn],
      effect: iam.Effect.ALLOW,
      actions: [
        "ecr:DescribeRepositories",
        "ecr:BatchDeleteImage",
        "ecr:DeleteRegistryPolicy",
        "ecr:ListImages",
        "ecr:DeleteRepositoryPolicy",
        "ecr:DeleteLifecyclePolicy",
        "ecr:DeleteRepository",
      ],
    });

    ecrCleanUpRole.addToPrincipalPolicy(this.ecrPolicy);

    this.batchLambdaParam = new ssm.StringListParameter(
      this,
      `${prefix}-LambdaParam`,
      {
        parameterName: "treeLambdaEnv",
        stringListValue: [batchJobDef.ref, batchJobQ.ref, batchComputeEnv.ref],
        tier: ssm.ParameterTier.STANDARD,
        simpleName: true,
      }
    );

    this.batchEcrCleanupParam = new ssm.StringParameter(
      this,
      "batch-ecr-cleanup-ssm-param",
      {
        parameterName: "batchEcrClean",
        stringValue: batchImageRepo.repositoryName,
        tier: ssm.ParameterTier.STANDARD,
        simpleName: true,
      }
    );
  }
}
