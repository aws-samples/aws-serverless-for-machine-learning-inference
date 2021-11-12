# Machine learning inference at scale using AWS serverless

With the growing adoption of Machine Learning (ML) across industries, there is an increasing demand for faster and easier ways to run ML inference at scale. ML use cases, such as manufacturing defect detection, demand forecasting, fraud surveillance, and many others, involve tens or thousands of datasets, including images, videos, files, documents, and other artifacts. These inference use cases typically require the workloads to scale to tens of thousands of parallel processing units. The simplicity and automated scaling offered by AWS serverless solutions makes it a great choice for running ML inference at scale. Using serverless, inferences can be run without provisioning or managing servers and while only paying for the time it takes to run. ML practitioners can easily bring their own ML models and inference code to AWS by using containers.
This post shows you how to run and scale ML inference using AWS serverless solutions: [AWS Lambda](https://aws.amazon.com/lambda/) and [AWS Fargate](https://aws.amazon.com/fargate/).

## Solution overview

The following diagram illustrates the solutions architecture for both batch and real-time inference options. The solution is demonstrated using a sample image classification use case.

![architecture](architecture.png)

## Deploying the solution

We have created an [AWS Cloud Development Kit (CDK)](https://docs.aws.amazon.com/cdk/latest/guide/home.html) template to define and configure the resources for the sample solution. CDK lets you provision the infrastructure and build deployment packages for both the Lambda Function and Fargate container. The packages include commonly used ML libraries, such as [Apache MXNet](https://mxnet.apache.org/versions/1.8.0/) and [Python](https://www.python.org), along with their dependencies. The solution is running the inference code using a ResNet-50 model trained on the [ImageNet](https://image-net.org/index.php) dataset to recognize objects in an image. The model can classify images into 1000 object categories, such as keyboard, mouse, pencil, and many animals. The inference code downloads the input image and performs the prediction with the five classes that the image most relates with the respective probability.

To follow along and run the solution, you need access to:

- An AWS account
- A terminal with [AWS Command Line Interface (CLI)](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html), [CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install), [Docker](https://www.docker.com/), [git](https://git-scm.com/), and Python installed.
  - You may use the terminal on your local machine or use an [AWS Cloud9](https://aws.amazon.com/cloud9/) environment.

To deploy the solution, open your terminal window and complete the following steps.

1. Clone the GitHub repo <br />
   `git clone https://github.com/aws-samples/aws-serverless-for-machinelearning-inference`

2. Navigate to the project directory and deploy the CDK application. <br />
   `./install.sh`
   <br /> or <br />
   `./cloud9_install.sh #If you are using AWS Cloud9` <br />
   Enter `Y` to proceed with the deployment.

## Running inference

The sample solution lets you get predictions for either a set of images using batch inference or for a single image at a time using real-time API end-point. <br />Complete the following steps to run inferences for each scenario.

### Batch inference

#### Get batch predictions by uploading image files to Amazon S3.

1. Upload one or more image files to the S3 bucket path, **_ml-serverless-bucket-<acct-id>-<aws-region>/input_**, from [Amazon S3 console](https://console.aws.amazon.com/s3/home) or using [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html).<br />
   `aws s3 cp <path to jpeg files> s3://ml-serverless-bucket-<acct-id>-<aws-region>/input/ --recursive`
2. This will trigger the batch job, which will spin-off [Fargate](https://aws.amazon.com/fargate/) tasks to run the inference. You can monitor the job status in [AWS Batch console](https://console.aws.amazon.com/batch/home).
3. Once the job is complete (this may take a few minutes), inference results can be accessed from the **_ml-serverless-bucket-<acct-id>-<aws-region>/output_** path

## Real-time inference

Get real-time predictions by invoking the REST API endpoint with an image payload.

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
