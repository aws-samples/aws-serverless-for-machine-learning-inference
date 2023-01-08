import * as cdk from "aws-cdk-lib";
import ec2 = require("aws-cdk-lib/aws-ec2");
import { Construct } from "constructs";

const prefix = "MLServerlessStack";

export class BaseResources extends cdk.NestedStack {
  vpc: ec2.Vpc;
  batchSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, `${prefix}-vpc`, {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
    });

    this.batchSg = new ec2.SecurityGroup(this, `${prefix}-batch-sg`, {
      vpc: this.vpc,
      securityGroupName: `${prefix}-batch-sg`,
    });

    this.batchSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      ec2.Protocol.ALL
    );
  }
}
