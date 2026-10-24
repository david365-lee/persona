const fs = require('fs');
const path = require('path');
const items = [];
const add = x => (items.push(x), x);
const meta = (name, namespace, rest={}) => ({name, namespace, ...rest});
for (const name of ['minio','nexus','milvus','pritunl','harbor']) add({apiVersion:'v1',kind:'Namespace',metadata:{name}});
add({apiVersion:'storage.k8s.io/v1',kind:'StorageClass',metadata:{name:'platform-local-retain'},provisioner:'rancher.io/local-path',reclaimPolicy:'Retain',volumeBindingMode:'WaitForFirstConsumer'});
const secret = (name,key,envName=key) => ({name:envName,valueFrom:{secretKeyRef:{name,key}}});
function pvc(ns,name,size) {add({apiVersion:'v1',kind:'PersistentVolumeClaim',metadata:meta(name,ns),spec:{accessModes:['ReadWriteOnce'],storageClassName:'platform-local-retain',resources:{requests:{storage:size}}}});}
function svc(ns,name,ports,type='ClusterIP') {add({apiVersion:'v1',kind:'Service',metadata:meta(name,ns),spec:{type,selector:{app:name},ports}});}
function ingress(ns,name,host,port,extra={}) {add({apiVersion:'networking.k8s.io/v1',kind:'Ingress',metadata:meta(name,ns,{annotations:{'nginx.org/client-max-body-size':'0','nginx.org/proxy-read-timeout':'600s','nginx.org/proxy-send-timeout':'600s','nginx.org/proxy-set-headers':'X-Forwarded-Proto: https, X-Forwarded-Port: 443','nginx.org/ssl-redirect':'false',...extra}}),spec:{ingressClassName:'nginx',rules:[{host,http:{paths:[{path:'/',pathType:'Prefix',backend:{service:{name,port:{number:port}}}}]}}]}});}
function deploy(ns,name,containers,volumes=[],extra={}) {return add({apiVersion:'apps/v1',kind:'Deployment',metadata:meta(name,ns),spec:{replicas:1,strategy:{type:'Recreate'},selector:{matchLabels:{app:name}},template:{metadata:{labels:{app:name}},spec:{automountServiceAccountToken:false,terminationGracePeriodSeconds:120,containers,volumes,...extra}}}});}
function probes(port,path='/') {return {startupProbe:{httpGet:{path,port},periodSeconds:10,failureThreshold:90,timeoutSeconds:5},readinessProbe:{httpGet:{path,port},periodSeconds:10,timeoutSeconds:5}};}
const res=(cpu,mem,max)=>({requests:{cpu,memory:mem},limits:{cpu:'2',memory:max}});
pvc('minio','minio-data','100Gi');
const minioRef='7aac2a2c5b7c882e68c1ce017d8256be2feea27f';
deploy('minio','minio',[{
  name:'minio',image:'debian:bookworm-slim',command:['/build/minio'],args:['server','/data','--address',':9000','--console-address',':9001'],
  env:[secret('minio-admin','username','MINIO_ROOT_USER'),secret('minio-admin','password','MINIO_ROOT_PASSWORD'),{name:'MINIO_BROWSER_REDIRECT_URL',value:'https://minio.clush.cloud'},{name:'SSL_CERT_FILE',value:'/build/ca-certificates.crt'}],
  ports:[{name:'s3',containerPort:9000},{name:'console',containerPort:9001}],resources:res('100m','256Mi','1Gi'),...probes(9000,'/minio/health/ready'),
  volumeMounts:[{name:'storage',mountPath:'/data',subPath:'data'},{name:'storage',mountPath:'/build',subPath:'bin',readOnly:true}]
}], [{name:'storage',persistentVolumeClaim:{claimName:'minio-data'}}],{initContainers:[{
  name:'build-minio',image:'golang:1.26-bookworm',command:['bash','-ec'],args:[`set -o pipefail
if [ ! -x /build/minio ] || [ "$(cat /build/source-ref 2>/dev/null || true)" != "${minioRef}" ]; then
  mkdir -p /tmp/source
  curl -fsSL https://codeload.github.com/minio/minio/tar.gz/${minioRef} | tar -xz --strip-components=1 -C /tmp/source
  cd /tmp/source
  CGO_ENABLED=0 GOMAXPROCS=2 go build -p 2 -trimpath -ldflags "$(go run buildscripts/gen-ldflags.go)" -o /build/minio .
  echo ${minioRef} > /build/source-ref
fi
cp /etc/ssl/certs/ca-certificates.crt /build/ca-certificates.crt`],resources:{requests:{cpu:'500m',memory:'512Mi'},limits:{cpu:'2',memory:'3Gi'}},volumeMounts:[{name:'storage',mountPath:'/build',subPath:'bin'}]
}]});
svc('minio','minio',[{name:'s3',port:9000,targetPort:9000},{name:'console',port:9001,targetPort:9001}]);
ingress('minio','minio','minio.clush.cloud',9001,{'nginx.org/websocket-services':'minio','nginx.org/proxy-buffering':'false'});
add({apiVersion:'networking.k8s.io/v1',kind:'Ingress',metadata:meta('minio-s3','minio',{annotations:{'nginx.org/client-max-body-size':'0','nginx.org/proxy-buffering':'false','nginx.org/proxy-read-timeout':'600s','nginx.org/proxy-set-headers':'X-Forwarded-Proto: https, X-Forwarded-Port: 443'}}),spec:{ingressClassName:'nginx',rules:[{host:'s3.clush.cloud',http:{paths:[{path:'/',pathType:'Prefix',backend:{service:{name:'minio',port:{number:9000}}}}]}}]}});
pvc('nexus','nexus-data','100Gi');
deploy('nexus','nexus',[{name:'nexus',image:'sonatype/nexus3@sha256:0477ceb3b9c4c46d6a3f21a1f878a11f1ea9d2cdfdb3b3b8336a8a3df5c463d5',
 env:[{name:'INSTALL4J_ADD_VM_PARAMS',value:'-Xms1024m -Xmx1536m -XX:MaxDirectMemorySize=1024m -Djava.util.prefs.userRoot=/nexus-data/javaprefs'}],
 ports:[{name:'http',containerPort:8081}],resources:res('500m','2Gi','4Gi'),...probes(8081,'/service/rest/v1/status'),volumeMounts:[{name:'storage',mountPath:'/nexus-data'}]}],
 [{name:'storage',persistentVolumeClaim:{claimName:'nexus-data'}}],{securityContext:{fsGroup:200}});
svc('nexus','nexus',[{name:'http',port:8081,targetPort:8081}]); ingress('nexus','nexus','nexus.clush.cloud',8081);
pvc('milvus','attu-data','2Gi');
deploy('milvus','attu',[{name:'attu',image:'zilliz/attu:v3.0.1@sha256:19e8ae3b1c0a50f880209be07959cd8d3b57456abf220252a35fcefc40a9cd4b',
 env:[{name:'MILVUS_ADDRESS',value:'milvus.milvus.svc.cluster.local:19530'},{name:'MILVUS_USERNAME',value:'root'},secret('milvus-admin','password','MILVUS_PASSWORD'),{name:'ATTU_ADMIN_USER',value:'root'},secret('attu-admin','password','ATTU_ADMIN_PASSWORD'),{name:'ATTU_AUTH_MODE',value:'local'},{name:'ATTU_AUTH_COOKIE_SECURE',value:'true'}],
 ports:[{name:'http',containerPort:3000}],resources:res('100m','256Mi','768Mi'),...probes(3000,'/login'),volumeMounts:[{name:'storage',mountPath:'/data'}]}],[{name:'storage',persistentVolumeClaim:{claimName:'attu-data'}}],{securityContext:{fsGroup:1000}});
svc('milvus','attu',[{name:'http',port:3000,targetPort:3000}]); ingress('milvus','attu','attu.clush.cloud',3000,{'nginx.org/websocket-services':'attu'});
pvc('pritunl','pritunl-data','10Gi');
deploy('pritunl','pritunl',[
 {name:'mongodb',image:'mongo:8.0',args:['--bind_ip','127.0.0.1','--wiredTigerCacheSizeGB','0.25'],resources:res('100m','256Mi','768Mi'),volumeMounts:[{name:'storage',mountPath:'/data/db',subPath:'mongodb'}]},
 {name:'pritunl',image:'ghcr.io/jippi/docker-pritunl:latest-minimal@sha256:f588e4fb3d5e335f5d5a03699188ed6ebdca1cdf0ab182a9a880c67d3a24d3c0',env:[{name:'PRITUNL_MONGODB_URI',value:'mongodb://127.0.0.1:27017/pritunl'}],securityContext:{privileged:true},ports:[{name:'https',containerPort:443},{name:'vpn',containerPort:1194,protocol:'UDP'}],resources:res('100m','256Mi','1Gi'),startupProbe:{tcpSocket:{port:443},periodSeconds:10,failureThreshold:60},readinessProbe:{httpGet:{path:'/',port:443,scheme:'HTTPS'},periodSeconds:10,timeoutSeconds:5},volumeMounts:[{name:'storage',mountPath:'/var/lib/pritunl',subPath:'pritunl'},{name:'tun',mountPath:'/dev/net/tun'}]}
 ],[{name:'storage',persistentVolumeClaim:{claimName:'pritunl-data'}},{name:'tun',hostPath:{path:'/dev/net/tun',type:'CharDevice'}}]);
const pritunlPod=items.find(x=>x.kind==='Deployment' && x.metadata.name==='pritunl').spec.template.spec;
const pritunlPackage='pritunl_1.34.4763.45-0ubuntu1~focal_amd64.deb';
pritunlPod.initContainers=[{
 name:'fetch-current-pritunl',image:pritunlPod.containers[1].image,command:['bash','-ec'],
 args:[`cd /packages
if [ ! -f '${pritunlPackage}' ]; then
  apt-get update -qq
  apt-get download 'pritunl=1.34.4763.45-0ubuntu1~focal'
fi
echo 'e36d8f5d68681ef6c677380eeeac5439ebec64bd7eb888de219537456433c929  ${pritunlPackage}' | sha256sum -c -`],
 resources:res('100m','128Mi','512Mi'),volumeMounts:[{name:'storage',mountPath:'/packages',subPath:'packages'}]
}];
pritunlPod.containers[1].command=['bash','-ec'];
pritunlPod.containers[1].args=[`dpkg -i '/packages/${pritunlPackage}'; exec /bin/start-pritunl`];
pritunlPod.containers[1].volumeMounts.push({name:'storage',mountPath:'/packages',subPath:'packages',readOnly:true});
svc('pritunl','pritunl',[{name:'https',port:443,targetPort:443}]);
svc('pritunl','pritunl-vpn',[{name:'openvpn',port:1194,targetPort:1194,protocol:'UDP'}],'LoadBalancer');
// Match the VPN service to the application rather than its own service name.
items.at(-1).spec.selector={app:'pritunl'};
ingress('pritunl','pritunl','pritunl.clush.cloud',443,{'nginx.org/ssl-services':'pritunl'});
ingress('harbor','harbor','harbor.clush.cloud',80);
ingress('gitlab','gitlab','gitlab.clush.cloud',80,{'nginx.org/websocket-services':'gitlab'});
fs.writeFileSync(path.join(__dirname,'manifests.json'),JSON.stringify({apiVersion:'v1',kind:'List',items},null,2)+'\n');
console.log(`Generated ${items.length} resources`);
