# Machine learning inference at scale using AWS serverless

This sample solution shows you how to run and scale ML inference using AWS serverless services: [AWS Lambda](https://aws.amazon.com/lambda/) and [AWS Fargate](https://aws.amazon.com/fargate/). This is demonstrated using an image classification use case.

## Architecture

The following diagram illustrates the solutions architecture for both batch and real-time inference options. 

![architecture](architecture.png)

## Deploying the solution

### To deploy and run the solution, you need access to:
- An AWS account
- A terminal with [AWS Command Line Interface (CLI)](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html), [CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install), [Docker](https://www.docker.com/), [git](https://git-scm.com/), and Python installed.
  - You may use the terminal on your local machine or use an [AWS Cloud9](https://aws.amazon.com/cloud9/) environment.

### To deploy the solution, open your terminal window and complete the following steps.

1. Clone the GitHub repo <br />
   `git clone https://github.com/aws-samples/aws-serverless-for-machine-learning-inference.git`

2. Navigate to the project directory and deploy the CDK application. <br />
   `./install.sh`
   <br /> or <br />
   `./cloud9_install.sh #If you are using AWS Cloud9` <br />
   Enter `Y` to proceed with the deployment.

## Running inference

The solution lets you get predictions for either a set of images using batch inference or for a single image at a time using real-time API end-point.

### Batch inference

Get batch predictions by uploading image files to Amazon S3.

1. Upload one or more image files to the S3 bucket path, **_ml-serverless-bucket-<acct-id>-<aws-region>/input_**, from [Amazon S3 console](https://console.aws.amazon.com/s3/home) or using [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html).<br />
   `aws s3 cp <path to jpeg files> s3://ml-serverless-bucket-<acct-id>-<aws-region>/input/ --recursive`
2. This will trigger the batch job, which will spin-off [Fargate](https://aws.amazon.com/fargate/) tasks to run the inference. You can monitor the job status in [AWS Batch console](https://console.aws.amazon.com/batch/home).
3. Once the job is complete (this may take a few minutes), inference results can be accessed from the **_ml-serverless-bucket-<acct-id>-<aws-region>/output_** path

### Real-time inference

Get real-time predictions by invoking the API endpoint with an image payload.

1. Navigate to the [CloudFormation console](https://console.aws.amazon.com/cloudformation/home) and find the API endpoint URL **_(httpAPIUrl)_** from the stack output.
2. Use a REST client, like [Postman](https://www.postman.com/) or [curl](https://curl.se/) command, to send a **POST** request to the **_/predict_** api endpoint with image file payload.<br />
   `curl --request POST -H "Content-Type: application/jpeg" --data-binary @<your jpg file name> <your-api-endpoint-url>/predict`
3. Inference results are returned in the API response.

## Cleaning up

Navigate to the project directory from the terminal window and run the following command to destroy all resources and avoid incurring future charges.<br />
`cdk destroy`

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
