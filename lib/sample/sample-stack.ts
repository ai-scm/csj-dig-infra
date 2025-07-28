import { AppSourceConfig, InfraSourceConfig, PipelineConstruct, PipelineConstructProps } from '@blend-col/cdk-pipeline-construct-double-rep';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CSJDigSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const AppRepoSourceConfig: AppSourceConfig = {
      owner: 'ai-scm',
      branch: 'main',
      connectionArn: 'arn:aws:',
      repo: 'csj-dig-prod-app-sample',
      triggerOnPush: true,
    }

    const infraRepoSourceConfig: InfraSourceConfig = {
      owner: 'ai-scm',
      branch: 'main',
      connectionArn: 'arn:aws:',
      repo: 'csj-dig-prod-infra',
      triggerOnPush: true,
    }

    const pathBuildSpecBuild = './configuration/sample/buildspec_build.yml'
    const pathBuildSpecDeploy = './configuration/sample/buildspec_deploy.yml'
    
    const pipelineProps: PipelineConstructProps = {
      namespace: 'CSJDigSampleApp',
      pipelineType: 'fargate',
      ecrRepositoryName: 'csj-dig-prod-sample-repo',
      appSourceConfig: AppRepoSourceConfig,
      infraSourceConfig: infraRepoSourceConfig,
      buildConfig: {
        privileged: true,   // Requerido para Docker builds
        environmentVariables: {
          IMAGE_REPO_NAME: { value: 'csj-dig-prod-repo-en-ecr' },   // Nombre del repositorio ECR
          OTHER_ENV_VARIABLE: { value: 'value' }
        },
        buildSpec: cdk.aws_codebuild.BuildSpec.fromAsset(pathBuildSpecBuild),
      },
      deployConfig: {
        buildSpec: cdk.aws_codebuild.BuildSpec.fromAsset(pathBuildSpecDeploy),
        environmentVariables: {
          ENV_VARIABLE: { value: 'value' }
        }
      }
    }

    new PipelineConstruct(this, 'CSJDigSampleAppPipeline', pipelineProps);
  }
}
