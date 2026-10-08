<script>
	import initApp from '@/common/appInit.js'
	// uni-id-pages 已划入微信分包，主包 app.js 不能跨分包 require 其 init.js（会报 module is not defined）。
	// init.js 在小程序端为空操作（debug:false、push 未配置、clientDB 错误监听为空函数），故 MP 端跳过。
	// #ifndef MP
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js'
	// #endif

	export default {
		globalData: {
			searchText: '',
			appVersion: {},
			config: {},
			$i18n: {},
			$t: {}
		},
		onLaunch: function() {
			console.log('App Launch')
			this.globalData.$i18n = this.$i18n
			this.globalData.$t = str => this.$t(str)
			initApp();
			// #ifndef MP
			uniIdPageInit()
			// #endif

			// #ifdef APP
			//checkIsAgree(); APP端暂时先用原生默认生成的。目前，自定义方式启动vue界面时，原生层已经请求了部分权限这并不符合国家的法规
			// #endif

			// #ifdef H5
			// checkIsAgree(); // 默认不开启。目前全球，仅欧盟国家有网页端同意隐私权限的需要。如果需要可以自己去掉注视后生效
			// #endif

			// #ifdef APP-PLUS
			//idfa有需要的用户在应用首次启动时自己获取存储到storage中
			/*var idfa = '';
			var manager = plus.ios.invoke('ASIdentifierManager', 'sharedManager');
			if(plus.ios.invoke(manager, 'isAdvertisingTrackingEnabled')){
				var identifier = plus.ios.invoke('ASIdentifierManager', 'sharedManager');
				var advertisingIdentifier = plus.ios.invoke(identifier, 'UUIDString');
				console.log('idfa = '+advertisingIdentifier);
				plus.ios.deleteObject(identifier);
				plus.ios.deleteObject(advertisingIdentifier);
				plus.ios.deleteObject(manager);
			}
			console.log('idfa = '+idfa);*/
			// #endif
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	/* ========== 全局设计系统（参考腾讯 TDesign 移动端规范） ========== */
	page {
		/* 品牌色（腾讯蓝） */
		--ui-brand: #0052D9;
		--ui-brand-hover: #366EF4;
		--ui-brand-active: #003CAB;
		--ui-brand-light: #F2F3FF;
		--ui-brand-focus: #D9E1FF;
		/* 语义色 */
		--ui-success: #2BA471;
		--ui-success-light: #E3F9E9;
		--ui-warning: #E37318;
		--ui-warning-light: #FFF1E9;
		--ui-error: #D54941;
		--ui-error-light: #FFF0ED;
		/* 中性色 */
		--ui-text-1: rgba(0, 0, 0, 0.90);
		--ui-text-2: rgba(0, 0, 0, 0.60);
		--ui-text-3: rgba(0, 0, 0, 0.40);
		--ui-text-4: rgba(0, 0, 0, 0.26);
		--ui-bg-page: #F3F3F3;
		--ui-bg-gray: #F3F3F3;
		--ui-border: #E7E7E7;

		background-color: #F3F3F3;
		color: rgba(0, 0, 0, 0.90);
		font-size: 28rpx;
		font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
	}

	/* ---- 卡片与文本 ---- */
	.ui-card {
		background: #FFFFFF;
		border-radius: 16rpx;
		padding: 32rpx;
	}

	.ui-section-title {
		display: block;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--ui-text-1);
		margin-bottom: 20rpx;
	}

	.ui-row {
		display: flex;
		margin-bottom: 20rpx;
	}
	.ui-row:last-child {
		margin-bottom: 0;
	}
	.ui-row .ui-label {
		width: 180rpx;
		flex-shrink: 0;
		font-size: 28rpx;
		color: var(--ui-text-2);
	}
	.ui-row .ui-value {
		flex: 1;
		font-size: 28rpx;
		color: var(--ui-text-1);
	}

	.ui-text-secondary { color: var(--ui-text-2); }
	.ui-text-placeholder { color: var(--ui-text-3); }
	.ui-text-success { color: var(--ui-success); }
	.ui-text-warning { color: var(--ui-warning); }
	.ui-text-error { color: var(--ui-error); }
	.ui-text-brand { color: var(--ui-brand); }
	.ui-text-bold { font-weight: 600; }

	/* ---- 按钮 ---- */
	.ui-btn {
		display: block;
		width: 100%;
		height: 88rpx;
		line-height: 88rpx;
		border-radius: 12rpx;
		font-size: 32rpx;
		font-weight: 600;
		text-align: center;
		border: none;
		padding: 0;
		margin: 0;
	}
	.ui-btn::after {
		border: none;
	}
	.ui-btn-primary {
		background: var(--ui-brand);
		color: #FFFFFF;
	}
	.ui-btn-primary:active {
		background: var(--ui-brand-active);
	}
	.ui-btn-danger {
		background: var(--ui-error);
		color: #FFFFFF;
	}
	.ui-btn-warning {
		background: var(--ui-warning);
		color: #FFFFFF;
	}
	.ui-btn-success {
		background: var(--ui-success);
		color: #FFFFFF;
	}
	.ui-btn-outline {
		background: #FFFFFF;
		color: var(--ui-brand);
		border: 2rpx solid var(--ui-brand);
		box-sizing: border-box;
	}
	.ui-btn-gray {
		background: var(--ui-bg-gray);
		color: var(--ui-text-2);
	}
	.ui-btn[disabled] {
		opacity: 0.4;
	}

	/* ---- 状态徽标 ---- */
	.ui-badge {
		display: inline-block;
		font-size: 22rpx;
		line-height: 1.4;
		padding: 6rpx 16rpx;
		border-radius: 8rpx;
		white-space: nowrap;
	}
	.ui-badge-pending { background: var(--ui-warning-light); color: var(--ui-warning); }
	.ui-badge-approved { background: var(--ui-success-light); color: var(--ui-success); }
	.ui-badge-checked_in { background: var(--ui-brand-light); color: var(--ui-brand); }
	.ui-badge-ended { background: #F0F0F0; color: var(--ui-text-3); }
	.ui-badge-rejected { background: var(--ui-error-light); color: var(--ui-error); }
	.ui-badge-cancelled { background: #F0F0F0; color: var(--ui-text-3); }
	.ui-badge-cancel_pending { background: var(--ui-warning-light); color: var(--ui-warning); }
	.ui-badge-active { background: var(--ui-error-light); color: var(--ui-error); }
	.ui-badge-brand { background: var(--ui-brand-light); color: var(--ui-brand); }
	.ui-badge-gray { background: #F0F0F0; color: var(--ui-text-3); }

	/* ---- 表单 ----
	   注意：小程序原生 input / textarea 自带高度且被 nvue.wxss 设为 border-box，
	   只写 padding 会把内容区挤没，必须显式声明 height + line-height。 */
	.ui-input {
		display: block;
		width: 100%;
		height: 88rpx;
		min-height: 88rpx;
		line-height: 88rpx;
		box-sizing: border-box;
		background: var(--ui-bg-gray);
		padding: 0 28rpx;
		border-radius: 12rpx;
		font-size: 28rpx;
		color: var(--ui-text-1);
		overflow: hidden;
		flex-shrink: 0;
	}
	/* 原生控件单独再兜一层，避免组件默认样式覆盖 */
	input.ui-input,
	textarea.ui-input {
		height: 88rpx;
		min-height: 88rpx;
		line-height: 88rpx;
		padding: 0 28rpx;
	}
	.ui-input.placeholder {
		color: var(--ui-text-3);
	}
	.ui-input.readonly {
		color: var(--ui-text-2);
	}
	.ui-textarea {
		display: block;
		width: 100%;
		height: 220rpx;
		min-height: 220rpx;
		box-sizing: border-box;
		background: var(--ui-bg-gray);
		padding: 20rpx 28rpx;
		border-radius: 12rpx;
		font-size: 28rpx;
		line-height: 44rpx;
		color: var(--ui-text-1);
		flex-shrink: 0;
	}
	/* placeholder-class 必须用全局类，页面 scoped 样式对原生占位符不生效 */
	.input-placeholder {
		color: var(--ui-text-3);
		font-size: 28rpx;
		font-weight: normal;
	}

	/* ---- 空状态 ---- */
	.ui-empty {
		background: #FFFFFF;
		border-radius: 16rpx;
		padding: 100rpx 0;
		text-align: center;
	}
	.ui-empty-text {
		font-size: 28rpx;
		color: var(--ui-text-3);
	}

	/* ---- 弹窗（浮层用阴影） ---- */
	.ui-modal-mask {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.ui-modal {
		background: #FFFFFF;
		border-radius: 24rpx;
		width: 600rpx;
		padding: 48rpx 40rpx;
		box-shadow: 0 12rpx 48rpx rgba(0, 0, 0, 0.12);
	}
	.ui-modal-title {
		display: block;
		font-size: 34rpx;
		font-weight: 600;
		color: var(--ui-text-1);
		margin-bottom: 32rpx;
		text-align: center;
	}
	.ui-modal-label {
		display: block;
		font-size: 28rpx;
		color: var(--ui-text-2);
		margin-bottom: 12rpx;
	}
	.ui-modal-footer {
		display: flex;
		gap: 16rpx;
		margin-top: 40rpx;
	}
	.ui-modal-btn {
		flex: 1;
		height: 84rpx;
		line-height: 84rpx;
		border-radius: 12rpx;
		font-size: 30rpx;
		border: none;
		padding: 0;
	}
	.ui-modal-btn::after {
		border: none;
	}
	.ui-modal-btn[disabled] {
		opacity: 0.4;
	}

	/* ---- 加载 ---- */
	.ui-loading-mask {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
	}
	.ui-loading-text {
		font-size: 28rpx;
		color: var(--ui-text-2);
	}

	/* ---- 底部操作条（非 tab 页） ---- */
	.ui-action-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #FFFFFF;
		padding: 20rpx 32rpx;
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
		border-top: 1rpx solid var(--ui-border);
		display: flex;
		gap: 16rpx;
	}
	.ui-action-bar .ui-btn,
	.ui-action-bar .ui-action-btn {
		flex: 1;
		height: 84rpx;
		line-height: 84rpx;
		font-size: 30rpx;
	}
</style>
