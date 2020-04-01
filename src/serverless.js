const {Component} = require('@serverless/core')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const random = require('ext/string/random')
const {MultiApigw, MultiScf, Cos, Cns} = require('tencent-component-toolkit')

const DEFAULTS = {
	handler: 'index.main_handler',
	runtime: 'Nodejs8.9',
	exclude: ['.git/**', '.gitignore', '.DS_Store'],
	timeout: 3,
	memorySize: 128
}

class Express extends Component {

	mergeJson(sourceJson, targetJson) {
		for (const eveKey in sourceJson) {
			if (targetJson.hasOwnProperty(eveKey)) {
				if (['protocols', 'endpoints', 'customDomain'].indexOf(eveKey) != -1) {
					for (let i = 0; i < sourceJson[eveKey].length; i++) {
						const sourceEvents = JSON.stringify(sourceJson[eveKey][i])
						const targetEvents = JSON.stringify(targetJson[eveKey])
						if (targetEvents.indexOf(sourceEvents) == -1) {
							targetJson[eveKey].push(sourceJson[eveKey][i])
						}
					}
				} else {
					if (typeof sourceJson[eveKey] != 'string') {
						this.mergeJson(sourceJson[eveKey], targetJson[eveKey])
					} else {
						targetJson[eveKey] = sourceJson[eveKey]
					}
				}
			} else {
				targetJson[eveKey] = sourceJson[eveKey]
			}
		}
		return targetJson
	}

	capitalString(str) {
		if (str.length < 2) {
			return str.toUpperCase()
		}

		return `${str[0].toUpperCase()}${str.slice(1)}`
	}

	async prepareInputs(inputs = {}) {
		// 对function inputs进行标准化
		const tempFunctionConf = inputs.functionConf ? inputs.functionConf : undefined
		const {framework} = inputs
		const fromClientRemark = `tencent-${framework}`

		const functionConf = {
			name:
				ensureString(inputs.functionName, {isOptional: true}) ||
				this.state.functionName ||
				`${framework}_component_${random({length: 6})}`,
			codeUri:
				ensureString(
					tempFunctionConf && tempFunctionConf.code ? tempFunctionConf.code : inputs.code,
					{isOptional: true}
				) || process.cwd(),
			region: inputs.region
				? typeof inputs.region == 'string'
					? [inputs.region]
					: inputs.region
				: ['ap-guangzhou'],
			handler: ensureString(
				tempFunctionConf && tempFunctionConf.handler ? tempFunctionConf.handler : inputs.handler,
				{default: DEFAULTS.handler}
			),
			runtime: ensureString(
				tempFunctionConf && tempFunctionConf.runtime ? tempFunctionConf.runtime : inputs.runtime,
				{default: DEFAULTS.runtime}
			),
			fromClientRemark
		}
		functionConf.include = ensureIterable(
			tempFunctionConf && tempFunctionConf.include ? tempFunctionConf.include : inputs.include,
			{default: [], ensureItem: ensureString}
		)
		functionConf.exclude = ensureIterable(
			tempFunctionConf && tempFunctionConf.exclude ? tempFunctionConf.exclude : inputs.exclude,
			{default: [], ensureItem: ensureString}
		)
		functionConf.exclude.push('.git/**', '.gitignore', '.serverless', '.DS_Store')
		if (inputs.functionConf) {
			functionConf.timeout = inputs.functionConf.timeout
				? inputs.functionConf.timeout
				: DEFAULTS.timeout
			functionConf.memorySize = inputs.functionConf.memorySize
				? inputs.functionConf.memorySize
				: DEFAULTS.memorySize
			if (inputs.functionConf.environment) {
				functionConf.environment = inputs.functionConf.environment
			}
			if (inputs.functionConf.vpcConfig) {
				functionConf.vpcConfig = inputs.functionConf.vpcConfig
			}
		}

		// 对apigw inputs进行标准化
		const apigatewayConf = inputs.apigatewayConf ? inputs.apigatewayConf : {}
		apigatewayConf.fromClientRemark = fromClientRemark
		apigatewayConf.serviceName = inputs.serviceName
		apigatewayConf.description = `Serverless Framework Tencent-${this.capitalString(
			framework
		)} Component`
		apigatewayConf.serviceId = inputs.serviceId
		apigatewayConf.region = functionConf.region
		apigatewayConf.protocols = apigatewayConf.protocols || ['http']
		apigatewayConf.environment = apigatewayConf.environment ? apigatewayConf.environment : 'release'
		apigatewayConf.endpoints = [
			{
				path: '/',
				method: 'ANY',
				function: {
					isIntegratedResponse: true,
					functionName: functionConf.name,
					functionNamespace: functionConf.namespace
				}
			}
		]

		// 对cns inputs进行标准化
		const tempCnsConf = {}
		const tempCnsBaseConf = inputs.cloudDNSConf ? inputs.cloudDNSConf : {}

		// 分地域处理functionConf/apigatewayConf/cnsConf
		for (let i = 0; i < functionConf.region.length; i++) {
			const curRegion = functionConf.region[i]
			const curRegionConf = inputs[curRegion]
			if (curRegionConf && curRegionConf.functionConf) {
				functionConf[curRegion] = curRegionConf.functionConf
			}
			if (curRegionConf && curRegionConf.apigatewayConf) {
				apigatewayConf[curRegion] = curRegionConf.apigatewayConf
			}

			const tempRegionCnsConf = this.mergeJson(
				tempCnsBaseConf,
				curRegionConf && curRegionConf.cloudDNSConf ? curRegionConf.cloudDNSConf : {}
			)

			tempCnsConf[functionConf.region[i]] = {
				recordType: 'CNAME',
				recordLine: tempRegionCnsConf.recordLine ? tempRegionCnsConf.recordLine : undefined,
				ttl: tempRegionCnsConf.ttl,
				mx: tempRegionCnsConf.mx,
				status: tempRegionCnsConf.status ? tempRegionCnsConf.status : 'enable'
			}
		}

		const cnsConf = []
		// 对cns inputs进行检查和赋值
		if (apigatewayConf.customDomain && apigatewayConf.customDomain.length > 0) {
			for (let domianNum = 0; domianNum < apigatewayConf.customDomain.length; domianNum++) {
				const tencentDomain = await this.load('@serverless/tencent-domain')
				const domainData = await tencentDomain.check({
					domain: apigatewayConf.customDomain[domianNum].domain
				})
				const tempInputs = {
					domain: domainData.domain,
					records: []
				}
				for (let eveRecordNum = 0; eveRecordNum < functionConf.region.length; eveRecordNum++) {
					if (tempCnsConf[functionConf.region[eveRecordNum]].recordLine) {
						tempInputs.records.push({
							subDomain: domainData.subDomain || '@',
							recordType: 'CNAME',
							recordLine: tempCnsConf[functionConf.region[eveRecordNum]].recordLine,
							value: `temp_value_about_${functionConf.region[eveRecordNum]}`,
							ttl: tempCnsConf[functionConf.region[eveRecordNum]].ttl,
							mx: tempCnsConf[functionConf.region[eveRecordNum]].mx,
							status: tempCnsConf[functionConf.region[eveRecordNum]].status || 'enable'
						})
					}
				}
				cnsConf.push(tempInputs)
			}
		}

		return {
			region: functionConf.region,
			functionConf: functionConf,
			apigatewayConf: apigatewayConf,
			cnsConf: cnsConf
		}
	}

	async uploadCodeToCos(inputs, region, filePath) {
		// 创建cos对象
		const cos = new Cos(credentials, region)

		// 创建存储桶 + 设置生命周期
		if (!inputs[region].code || !inputs[region].code.bucket) {
			inputs[region].code.bucket = `sls-cloudfunction-${region}-code`
			await cos.deploy({
				bucket: inputs[region].code.bucket,
				force: true,
				lifecycle: [
					{
						status: 'Enabled',
						id: 'deleteObject',
						filter: '',
						expiration: {days: '10'},
						abortIncompleteMultipartUpload: {daysAfterInitiation: '10'}
					}
				]
			})
		}

		// 上传代码
		const object = `${inputs.name}-${Number(Date.now() / 1000)}`
		inputs[region].code.object = object
		await cos.upload({
			bucket: inputs[region].code.bucket,
			file: filePath,
			key: inputs[region].code.object
		})
	}

	async deployFunction(credentials, inputs, regionList, outputs = {}) {
		// 打包代码
		// todo 打包这里还没有仔细看，可能这样用的不对
		const packageDir = await packageExpress(this, inputs)

		// 上传代码到COS
		const uploadCodeHandler = []
		for (let eveRegionIndex = 0; eveRegionIndex < regionList.length; eveRegionIndex++) {
			uploadCodeHandler.push(uploadCodeToCos(inputs, regionList[eveRegionIndex], packageDir))
		}
		await Promise.all(uploadCodeHandler)

		// 部署scf
		const scf = new MultiScf(credentials, regionList)
		outputs["scf"] = await scf.deploy(inputs)
	}


	async deployApigateway(credentials, inputs, regionList, outputs = {}) {
		const apigw = new MultiApigw(credentials, regionList)
		outputs["apigw"] = await apigw.deploy(inputs)
	}

	async deployCns(credentials, inputs, outputs = {}) {
		const cns = new Cns(credentials)
		outputs["cns"] = await cns.deploy(inputs)

	}

	async deploy(inputs) {
		console.log(`Deploying Express App...`)

		// 获取腾讯云密钥信息
		const credentials = this.credentials.tencent

		// 对Inputs内容进行标准化
		const {region, functionConf, apigatewayConf, cnsConf} = await this.prepareInputs(inputs)


		// 获取地域列表
		const regionList = typeof inputs.region == 'string' ? [inputs.region] : inputs.region


		// 部署函数 + API网关
		const outputs = {}
		await Promise.all([
			this.deployApigateway(credentials, apigatewayConf, regionList, outputs),
			this.deployFunction(credentials, functionConf, regionList, outputs),
		])

		// 云解析遇到等API网关部署完成才可以继续部署
		// this.deployCns(credentials, cnsConf, outputs)


		outputs.url = this.state.url
		if (this.state.domain) {
			outputs.domain = `https://${this.state.domain}`
		}

		return outputs
	}

	async remove() {
		// const clients = getClients(
		// 	process.env.SERVERLESS_PLATFORM_VENDOR === 'tencent'
		// 		? this.credentials.tencent
		// 		: this.credentials.aws,
		// 	this.state.region
		// )
		//
		// await removeAllRoles(this, clients)
		// await removeLambda(this, clients)
		// await removeDomain(this, clients)
		// await removeApi(this, clients)
		//
		// this.state = {}
		// return {}
	}
}

module.exports = Express
