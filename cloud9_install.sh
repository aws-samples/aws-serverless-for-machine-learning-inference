#!/bin/bash
set -e

sudo yum install -y jq
export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}
aws configure get default.region

NPM=$(command -v npm)

echo "Checking CDK Status"
if ! command -v cdk &> /dev/null; then
    echo -e "CDK is required, but it is not installed. \nInstalling CDK"
    $NPM install --prefix . aws-cdk
else
    echo "Updating CDK"
    $NPM update --prefix . aws-cdk
fi

echo "Installing Typescript"
$NPM install typescript

echo "Installing Node Modules"

cat cdkmodules.txt | xargs $NPM install --prefix .

echo "Creating SciPy and MXNet Lambda layer artifact"
cd lambda_fn/realtime_inf/layers/
chmod +x create-layer.sh
sudo sh create-layer.sh 3.6
cd -

echo "Deploying CDK Application"
CDK=$(command -v cdk)
# $CDK bootstrap aws://unknown-account/unknown-region
$CDK deploy
