#!/bin/bash
set -e

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
sh create-layer.sh 3.6
cd -

echo "Deploying CDK Application"
CDK=$(command -v cdk)
# $CDK bootstrap aws://unknown-account/unknown-region
$CDK deploy
