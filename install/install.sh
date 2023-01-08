#!/bin/bash
set -e

NPM=$(command -v npm)

echo "Checking CDK if is installed"
if ! command -v cdk &> /dev/null; then
    echo -e "CDK is required, but it is not installed. \nInstalling CDK"
    $NPM install --prefix . aws-cdk
else
    echo "Updating CDK"
    $NPM update -g aws-cdk
fi

echo "Checking if Typescript is installed"
if ! command -v tsc &> /dev/null; then
    echo "Installing Typescript"
    $NPM install typescript
else
    echo "Typescript is installed"
fi

if [ ! -f ../src/lambda_fn/realtime_inf/layers/mxnet.zip ]
then
    echo "Creating SciPy and MXNet Lambda layer artifact"
    cd ../src/lambda_fn/realtime_inf/layers/
    chmod +x create-layer.sh
    sh create-layer.sh 3.7 && cd -
else
    echo "Found existing mxnet.zip"
fi

echo "Installing Node Modules"
cd ../app

$NPM install

echo "Deploying CDK Application"
CDK=$(command -v cdk)
# $CDK bootstrap aws://unknown-account/unknown-region
$CDK deploy
