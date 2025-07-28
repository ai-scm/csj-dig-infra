import { AlbToFargate, AlbToFargateProps } from '@blend-col/alb-to-fargate';
import { AppSourceConfig, InfraSourceConfig, PipelineConstruct, PipelineConstructProps } from '@blend-col/cdk-pipeline-construct-double-rep';
import * as cdk from 'aws-cdk-lib';
import { Subnet, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class CSJDigSampleAlbToFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const AppRepoSourceConfig: AppSourceConfig = {
      owner: 'ai-scm',
      branch: 'main',
      connectionArn: 'arn:aws:codeconnections:us-east-1:875376228721:connection/47ece147-e3a3-4d86-9e2a-893bdf42eeee',
      repo: 'csj-dig-prod-app-sample',
      triggerOnPush: true,
    };

    const infraRepoSourceConfig: InfraSourceConfig = {
      owner: 'ai-scm',
      branch: 'main',
      connectionArn: 'arn:aws:codeconnections:us-east-1:875376228721:connection/47ece147-e3a3-4d86-9e2a-893bdf42eeee',
      repo: 'csj-dig-prod-infra',
      triggerOnPush: true,
    };

    let IMAGETAG;

    IMAGETAG = new cdk.CfnParameter(this, 'IMAGETAG', {
      type: 'String',
      description: 'Tag for the Docker image in ECR',
      default: 'latest',  // Valor por defecto
    }).valueAsString;

    const pathBuildSpecBuild = './configuration/sample/buildspec_build.yml';
    const pathBuildSpecDeploy = './configuration/sample/buildspec_deploy.yml';
    
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
    };

    const pipelineConstruct = new PipelineConstruct(this, 'CSJDigSampleAppPipeline', pipelineProps);

    const appName = 'csj-dig-prod-sample';
    const domainName = 'test.ia.blend360.com';
    const fullDomainName = `${appName}.${domainName}`;  // Ejemplo de dominio completo

    const vpc = Vpc.fromLookup(this, 'ExistingVPC', {
      vpcId: 'vpc-id'  // Reemplazar con el ID de la VPC existente
    });

    const repository = pipelineConstruct.ecrRepo;

    const taskRole = new Role(this, `${appName}TaskRole`, {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const existingPrivateSubnet = Subnet.fromSubnetId(this, 'ExistingPrivateSubnet', 'subnet-id'); // Reemplazar con el ID de la subred privada existente

    const albToFargateProps: AlbToFargateProps = {
      publicApi: true,    // Configura como API pública
      existingVpc: vpc,
      ecrRepository: repository!,
      namespace: appName,
      containerDefinitionProps: {
        containerName: `${appName}-container`,
        image: ecs.ContainerImage.fromEcrRepository(repository!, IMAGETAG),
        memoryLimitMiB: 512,  // Memoria asignada al contenedor
        cpu: 256,  // CPU asignada al contenedor
        portMappings: [{
          containerPort: 8000,  // Puerto del contenedor
          protocol: ecs.Protocol.TCP,  // Protocolo del puerto
        }],
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: `${appName}-logs`,
        }),
        environment: {
          ENV_VARIABLE: 'value',  // Variables de entorno del contenedor
        }
      },
      targetGroupProps: {
        healthCheck: {
          path: '/health',
          protocol: elbv2.Protocol.HTTP,
          interval: cdk.Duration.seconds(60),
          timeout: cdk.Duration.seconds(30),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 5,
          healthyHttpCodes: '200',
        },
        targetType: elbv2.TargetType.IP,
        port: 8000,  // Puerto del target group
        protocol: elbv2.ApplicationProtocol.HTTP, // Protocolo del target group
        targetGroupName: `${appName}-target-group`,
        deregistrationDelay: cdk.Duration.seconds(30)
      },
      listenerProps: {
        name: `${appName}-listener`,
        port: 443,  // Puerto del listener
        sslPolicy: elbv2.SslPolicy.RECOMMENDED,
        protocol: elbv2.ApplicationProtocol.HTTPS
      },
      // existingLoadBalancerObj: existingLoadBalancer, // Reemplazar con el objeto del ALB existente en caso de usar uno existente
      loadBalancerProps: {
        vpc: vpc,
        internetFacing: true,  // Configura el ALB para ser accesible desde Internet
        loadBalancerName: `${appName}-alb`,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,  // Tipo de subred para el ALB
        }
      },
      fargateServiceProps: {
        taskRole: taskRole,
        capacityProviderStrategies: [
          {
            capacityProvider: 'FARGATE_SPOT',
            weight: 4,
            base: 0
          },
          {
            capacityProvider: 'FARGATE',
            weight: 1,
            base: 1
          }
        ],
        serviceName: `${appName}-service`,
        desiredCount: 1,  // Número de instancias del servicio
        assignPublicIp: false,  // Asigna IPs públicas a las tareas
        enableAutoScaling: true,  // Habilita el autoescalado
        minHealthyPercent: 100,  // Porcentaje mínimo de tareas saludables
        maxHealthyPercent: 200,  // Porcentaje máximo de tareas saludables
        autoScaleTaskCount: {
          minCapacity: 1,  // Capacidad mínima de tareas
          maxCapacity: 5,  // Capacidad máxima de tareas
        },
        vpcSubnets: {
          scope: [ existingPrivateSubnet ],  // Subredes donde se desplegarán las tareas
        }
      },
      ruleProps: {
        priority: 10,  // Prioridad de la regla del listener
        conditions: [
          elbv2.ListenerCondition.pathPatterns(['/*'])  // Condiciones de la regla del listener
        ]
      },
      clusterProps: {
        clusterName: `${appName}-cluster`,
        vpc: vpc,
      },
      fargateTaskDefinitionProps: {
        taskRole: taskRole,
        cpu: 256,  // CPU asignada a la tarea
        memoryLimitMiB: 512,  // Memoria asignada a la tarea
        family: `${appName}-ECSTaskDefinition`,
        volumes: [],  // Volúmenes de la tarea
        ephemeralStorageGiB: 25,  // Almacenamiento efímero asignado a la tarea
      },
      domainName: domainName,  // Nombre de dominio para el ALB
      appDomainName: fullDomainName,  // Nombre de dominio completo para el ALB
    };

    const albToFargate = new AlbToFargate(this, `${appName}AlbToFargate`, albToFargateProps);

    const scaling = albToFargate.fargateService?.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5
    });

    scaling?.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,  // Porcentaje de utilización de CPU para activar el escalado
      scaleInCooldown: cdk.Duration.seconds(60),  // Tiempo de enfriamiento para escalado hacia adentro
      scaleOutCooldown: cdk.Duration.seconds(60),  // Tiempo de enfriamiento para escalado hacia afuera
    });

    scaling?.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50,  // Porcentaje de utilización de memoria para activar el escalado
      scaleInCooldown: cdk.Duration.seconds(60),  // Tiempo de enfriamiento para escalado hacia adentro
      scaleOutCooldown: cdk.Duration.seconds(60),  // Tiempo de enfriamiento para escalado hacia afuera
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: albToFargate.loadBalancer!.loadBalancerDnsName,
      description: 'DNS name of the load balancer',
    })
  }
}
