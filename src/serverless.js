const {Component} = require('@serverless/core')
const {MultiApigw, MultiScf, MultiScf, Cos, Cns} = require('tencent-component-toolkit')

class Express extends Component {

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


		// 获取地域列表
		const regionList = typeof inputs.region == 'string' ? [inputs.region] : inputs.region


		// 部署函数 + API网关 + 云解析
		const outputs = {}
		await Promise.all([
			deployApigateway(credentials, inputs, regionList, outputs),
			deployFunction(credentials, inputs, regionList, outputs),
			deployCns(credentials, inputs, outputs)
		])


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
