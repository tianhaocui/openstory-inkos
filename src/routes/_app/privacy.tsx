import { PRIVACY_EMAIL, SITE_CONFIG } from '@/ui/marketing/constants';
import { createFileRoute } from '@tanstack/react-router';

const title = `隐私政策 — ${SITE_CONFIG.name}`;

export const Route = createFileRoute('/_app/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${SITE_CONFIG.url}/privacy` },
      { name: 'twitter:title', content: title },
    ],
  }),
});

function JurisdictionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-block rounded border border-primary/30 bg-primary/10 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        法律
      </p>
      <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">
        隐私政策
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        生效日期：2026 年 3 月 16 日 &middot; 最后更新：2026 年 3 月 16 日
      </p>

      {/* 1. Introduction */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">1. 引言</h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name}（“我们”）是一个由 AI
          驱动的视频生成平台，可将电影剧本转化为完整的视频作品。我们致力于保护使用我们平台、访问我们网站或以其他方式与我们互动的个人隐私。
        </p>
        <p className="mt-4 leading-relaxed">
          本隐私政策说明我们如何依据以下法律法规收集、使用、披露、存储和保护个人信息：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            澳大利亚 <strong>Privacy Act 1988 (Cth)</strong>、
            <strong>Australian Privacy Principles</strong>（“APPs”）以及{' '}
            <strong>Privacy and Other Legislation Amendment Act 2024</strong>
          </li>
          <li>
            在我们向欧洲经济区（“EEA”）或英国境内个人提供服务时适用的{' '}
            <strong>General Data Protection Regulation (EU) 2016/679</strong>
            （“GDPR”）
          </li>
          <li>
            在达到适用门槛时适用的<strong>美国各州隐私法</strong>，包括经 CPRA
            修订的 California Consumer Privacy Act（“CCPA”）
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          如果某项规定仅适用于特定司法管辖区的用户，我们会以标签注明。
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            <strong>主体：</strong> {SITE_CONFIG.name}{' '}
            是由澳大利亚新南威尔士州个体经营者运营的注册商号。
          </p>
          <p className="mt-1">
            <strong>联系方式：</strong>{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
          <p className="mt-1">
            <strong>网站：</strong>{' '}
            <a
              href={SITE_CONFIG.url}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SITE_CONFIG.url}
            </a>
          </p>
        </div>
      </section>

      {/* 2. Scope */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">2. 适用范围</h2>
        <p className="mt-4 leading-relaxed">
          本隐私政策适用于通过以下渠道收集的个人信息：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            {SITE_CONFIG.name} 平台和 Web 应用（
            <a
              href={SITE_CONFIG.url}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SITE_CONFIG.url}
            </a>
            )
          </li>
          <li>我们的应用程序编程接口（API）</li>
          <li>您与我们的通信，包括电子邮件和支持渠道</li>
          <li>我们提供的任何相关服务、工具或功能</li>
        </ul>
      </section>

      {/* 3. What Is Personal Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          3. 什么是个人信息
        </h2>
        <p className="mt-4 leading-relaxed">
          根据澳大利亚 Privacy Act，<strong>个人信息</strong>
          是指与已识别个人或可被合理识别的个人有关的信息或意见，无论该信息或意见是否真实，也无论是否以实质形式记录。2024
          年修正案实施后，如果 IP
          地址等技术标识符可用于合理识别个人，也属于此定义范围。
        </p>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag> 根据 GDPR，
          <strong>个人数据</strong>
          是指与已识别或可识别自然人有关的任何信息。可识别个人是指可通过姓名、身份证明号码、位置数据或在线标识符等标识，直接或间接识别的个人。
        </p>
      </section>

      {/* 4. Information We Collect */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          4. 我们收集的信息
        </h2>

        <h3 className="mt-6 text-lg font-semibold">4.1 您直接提供的信息</h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>账户信息：</strong>
            姓名、邮箱地址、密码（以哈希形式存储）和账户偏好。
          </li>
          <li>
            <strong>付款信息：</strong>
            账单地址和付款详情。支付卡信息由第三方支付处理商处理，不会存储在我们的服务器上。
          </li>
          <li>
            <strong>内容和剧本：</strong>
            您为视频生成而上传或输入的电影剧本、场景描述、角色描述、创意简报及其他内容。
          </li>
          <li>
            <strong>通信：</strong>
            您通过电子邮件、支持请求或反馈表单发送给我们的消息。
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">4.2 自动收集的信息</h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>使用数据：</strong>
            使用的功能、执行的操作、生成历史、时间戳和会话时长。
          </li>
          <li>
            <strong>设备和技术数据：</strong>IP
            地址、浏览器类型和版本、操作系统、设备标识符和屏幕分辨率。
          </li>
          <li>
            <strong>日志数据：</strong>记录访问时间、浏览页面、来源 URL
            和错误报告的服务器日志。
          </li>
          <li>
            <strong>Cookie 和类似技术：</strong>我们使用
            Cookie、本地存储和类似跟踪技术来运营和改进平台（见第 17 节）。
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">4.3 来自第三方的信息</h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>身份验证服务商：</strong>如果您使用第三方服务（例如
            Google）登录，我们会在您授权的范围内接收您的姓名、邮箱和头像。
          </li>
          <li>
            <strong>分析服务商：</strong>汇总且经过假名化处理的使用分析数据。
          </li>
        </ul>
      </section>

      {/* 5. How We Use Your Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          5. 我们如何使用您的信息
        </h2>
        <p className="mt-4 leading-relaxed">
          我们仅出于履行我们的职能和活动所合理必要或与其直接相关的目的收集和使用个人信息（APP
          6）。这些目的包括：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>提供和运营平台：</strong>
            处理您的剧本、生成视频内容、管理您的账户并交付我们的服务。
          </li>
          <li>
            <strong>AI 处理：</strong>分析剧本以识别场景、角色和视觉元素，并使用
            AI 模型生成图像、视频和动态内容（见第 7 节）。
          </li>
          <li>
            <strong>改进服务：</strong>
            分析使用模式、诊断技术问题、开发新功能并提升平台性能。
          </li>
          <li>
            <strong>通信：</strong>发送服务相关通知、回复咨询并提供客户支持。
          </li>
          <li>
            <strong>安全和防欺诈：</strong>
            检测、预防和处理安全事件、欺诈与滥用行为。
          </li>
          <li>
            <strong>法律合规：</strong>
            遵守适用的法律、法规、法律程序或可执行的政府要求。
          </li>
          <li>
            <strong>营销（经同意）：</strong>
            在您选择接收时发送推广通信。您可随时选择退出。
          </li>
        </ul>
      </section>

      {/* 6. Lawful Basis for Processing (GDPR) */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          6. 处理的合法依据（GDPR）
        </h2>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag> 根据 GDPR，对于涉及 EEA
          或英国境内个人数据的每项处理活动，我们都必须具有合法依据。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          6.1 履行合同（第 6(1)(b) 条）
        </h3>
        <p className="mt-4 leading-relaxed">
          为履行我们与您之间的合同所必需的处理：创建和管理您的账户、处理剧本并生成视频内容、处理付款以及提供客户支持。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          6.2 合法利益（第 6(1)(f) 条）
        </h3>
        <p className="mt-4 leading-relaxed">
          在不凌驾于您的权利之上的情况下，为实现我们的合法利益所必需的处理：改进和优化平台、确保安全和防止欺诈、执行我们的服务条款以及行政管理。您有权反对此类处理（见第
          13 节）。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          6.3 同意（第 6(1)(a) 条）
        </h3>
        <p className="mt-4 leading-relaxed">
          在我们依赖您同意的情形下：发送营销通信和放置非必要
          Cookie。您可随时撤回同意，但不影响撤回前处理行为的合法性。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          6.4 法定义务（第 6(1)(c) 条）
        </h3>
        <p className="mt-4 leading-relaxed">
          为遵守法定义务所必需的处理：税务申报、回应合法的政府要求以及履行数据泄露通知要求。
        </p>

        <h3 className="mt-6 text-lg font-semibold">6.5 数据保护影响评估</h3>
        <p className="mt-4 leading-relaxed">
          我们已针对使用 AI
          模型处理用户提交内容开展数据保护影响评估（DPIA），以满足 GDPR 第 35
          条对使用创新技术且可能给数据主体带来高风险之处理活动的要求。摘要可应要求提供。
        </p>
      </section>

      {/* 7. AI Processing & Transparency */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          7. AI 处理与透明度
        </h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name}{' '}
          使用人工智能和机器学习系统分析剧本、生成视觉内容并制作视频输出。
        </p>

        <h3 className="mt-6 text-lg font-semibold">7.1 我们如何使用 AI</h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            大语言模型（LLM）分析您的剧本内容、识别场景、生成角色描述并创建视觉提示词。
          </li>
          <li>图像生成模型创建角色设定图、场景图像和视觉资产。</li>
          <li>视频生成模型制作动态内容并组装最终视频输出。</li>
          <li>您始终可以审阅、修改和重新生成任何 AI 输出。</li>
          <li>
            我们不会使用任何自动化流程拒绝您访问我们的服务，或作出对您产生法律效力的决定。
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">7.2 第三方 AI 服务商</h3>
        <p className="mt-4 leading-relaxed">
          您的内容由以下类别的第三方 AI
          服务商处理。我们与每家服务商均签订数据处理协议（DPA）。
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            <strong>大语言模型：</strong>
            Anthropic（Claude），用于剧本分析、场景拆分和提示词生成。根据零数据保留条款通过
            API 处理，不用于模型训练。
          </p>
          <p className="mt-2">
            <strong>图像生成：</strong>
            用于生成角色设定图和场景图像的服务商。根据 DPA 通过 API
            处理，不用于模型训练。
          </p>
          <p className="mt-2">
            <strong>视频生成：</strong>用于生成动态内容的服务商。根据 DPA 通过
            API 处理，不用于模型训练。
          </p>
        </div>
        <p className="mt-4 leading-relaxed">
          每份 DPA
          均包括目的限制、数据保留期限、子处理商通知、泄露通知、审计权和终止时删除数据等条款。服务商关系变化时，我们将更新本节。
        </p>

        <h3 className="mt-6 text-lg font-semibold">7.3 训练数据</h3>
        <p className="mt-4 leading-relaxed">
          <strong>我们不会使用您的剧本、内容或个人信息训练 AI 模型。</strong>{' '}
          您的内容仅用于生成您所请求的输出。我们的第三方 AI 服务商依据 API
          条款运营，该条款禁止将客户数据用于模型训练。
        </p>

        <h3 className="mt-6 text-lg font-semibold">7.4 AI 生成内容标记</h3>
        <p className="mt-4 leading-relaxed">
          我们正在实施措施，确保 AI 生成的视频内容以机器可读格式标记为 AI
          生成（在技术可行时使用 C2PA
          元数据标准）、可被识别为人工生成内容，并在适用法律要求时添加可见标签。这些措施将在
          EU AI Act 第 50 条规定的 2026 年 8 月 2 日透明度截止日期前落实。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          7.5 澳大利亚自动化决策（ADM）透明度
        </h3>
        <p className="mt-4 leading-relaxed">
          为遵守 Privacy and Other Legislation Amendment Act 2024（2026 年 12 月
          10 日生效）中的自动化决策透明度要求，我们的 AI
          系统会处理账户标识符、剧本内容和使用数据。这些自动化流程决定场景拆分、角色生成、视觉提示词和视频组装，是交付服务的核心环节。除根据您的输入生成创意内容外，它们不会作出可被合理预期为会严重影响您权利或利益的决定。
        </p>
      </section>

      {/* 8. Disclosure of Personal Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          8. 个人信息的披露
        </h2>
        <p className="mt-4 leading-relaxed">我们可能向以下主体披露个人信息：</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>服务商：</strong>
            依据合同义务代表我们处理数据的云托管、支付处理、邮件发送和分析服务商。
          </li>
          <li>
            <strong>AI 模型服务商：</strong>第三方 AI 服务（见第 7.2 节）。
          </li>
          <li>
            <strong>专业顾问：</strong>必要时包括律师、会计师和审计师。
          </li>
          <li>
            <strong>执法机关和监管机构：</strong>
            在法律、法院命令或监管义务要求时。
          </li>
          <li>
            <strong>业务转让：</strong>与出售或转让业务相关的情形。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          <strong>我们不会出售您的个人信息。</strong>
          我们不会为跨情境行为广告共享个人信息。
        </p>
      </section>

      {/* 9. International Data Transfers */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          9. 国际数据传输
        </h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name}{' '}
          总部位于澳大利亚，并在多个国家运营云基础设施和使用第三方服务。您的个人信息可能被传输至以下地区并在当地处理：
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            <strong>澳大利亚：</strong>主要业务运营。
          </p>
          <p className="mt-1">
            <strong>美国：</strong>云基础设施、AI
            模型服务商、支付处理和分析服务。
          </p>
          <p className="mt-1">
            <strong>其他国家：</strong>我们的服务商设有数据中心的国家。
          </p>
        </div>

        <h3 className="mt-6 text-lg font-semibold">
          9.1 澳大利亚用户保障措施（APP 8）
        </h3>
        <p className="mt-4 leading-relaxed">
          在向境外接收方披露个人信息前，我们会通过合同安排和数据处理协议采取合理措施，确保接收方按照
          APPs 处理这些信息。
        </p>

        <h3 className="mt-6 text-lg font-semibold">9.2 EEA/英国用户保障措施</h3>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag>{' '}
          澳大利亚尚未获得欧盟充分性认定。对于从 EEA
          或英国传输个人数据，我们依赖：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>标准合同条款（SCCs）：</strong>与服务商和 AI 模型服务商签订
            European Commission SCCs（模块
            2：控制者到处理者），并在必要时辅以额外技术和组织措施。
          </li>
          <li>
            <strong>EU-US Data Privacy Framework：</strong>
            适用于已通过该框架认证的美国服务商。
          </li>
          <li>
            <strong>传输影响评估：</strong>我们开展 TIA
            以评估各目的地国家的法律框架，并在发现风险时实施补充措施。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          您可联系以下邮箱，请求获取相关传输保障措施的副本：{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* 10. Data Retention */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">10. 数据保留</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>账户信息：</strong>在账户存续期间保留，并在账户删除后保留 12
            个月，法律要求更长期限的除外。
          </li>
          <li>
            <strong>生成内容：</strong>在账户有效期间保留，并在账户删除后 90
            天内删除。
          </li>
          <li>
            <strong>使用和日志数据：</strong>最长保留 24 个月，之后汇总或删除。
          </li>
          <li>
            <strong>付款记录：</strong>根据澳大利亚税法要求保留 7 年。
          </li>
          <li>
            <strong>支持通信：</strong>问题解决后保留 24 个月。
          </li>
          <li>
            <strong>AI 服务商处理：</strong>服务商不会在 API
            请求结束后保留输入或输出数据（零数据保留）。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          当不再需要个人信息时，我们会采取合理措施将其销毁或去标识化（APP
          11.2）。
        </p>
      </section>

      {/* 11. Data Security */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">11. 数据安全</h2>
        <p className="mt-4 leading-relaxed">
          我们采取合理的技术和组织措施保护个人信息（APP 11.1；GDPR 第 32
          条），包括：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>对传输中（TLS 1.2+）和静态数据进行加密</li>
          <li>访问控制和身份验证机制</li>
          <li>定期安全评估和监控</li>
          <li>承包商和员工保密义务</li>
          <li>事件响应和数据泄露通知程序</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          任何电子存储或传输方式都无法做到绝对安全。尽管我们努力保护您的个人信息，但无法保证其绝对安全。
        </p>
      </section>

      {/* 12. Your Rights — Australia */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          12. 您的权利——澳大利亚
        </h2>

        <h3 className="mt-6 text-lg font-semibold">12.1 访问权（APP 12）</h3>
        <p className="mt-4 leading-relaxed">
          您可请求访问我们持有的与您有关的个人信息。我们将在 30 天内回复。
        </p>

        <h3 className="mt-6 text-lg font-semibold">12.2 更正权（APP 13）</h3>
        <p className="mt-4 leading-relaxed">
          您可请求更正不准确、不完整、过时、不相关或具有误导性的个人信息。我们将在
          30 天内回复。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          12.3 匿名和使用化名（APP 2）
        </h3>
        <p className="mt-4 leading-relaxed">
          在可行的情况下，您可以使用化名或选择不表明身份，但这可能会限制您使用部分平台功能。
        </p>

        <h3 className="mt-6 text-lg font-semibold">12.4 直接营销（APP 7）</h3>
        <p className="mt-4 leading-relaxed">
          您可随时通过退订链接或联系以下邮箱选择退出营销通信：{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-semibold">12.5 直接诉权</h3>
        <p className="mt-4 leading-relaxed">
          根据 Privacy and Other Legislation Amendment Act
          2024，个人可就严重或反复侵犯隐私的行为，通过 Federal Court 直接向 APP
          实体索赔，无需先向 OAIC 投诉。
        </p>
      </section>

      {/* 13. Your Rights — EU/EEA (GDPR) */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          13. 您的权利——欧盟/EEA（GDPR）
        </h2>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag> 如果您位于 EEA
          或英国，则享有以下权利。请联系{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>{' '}
          以行使这些权利。我们将在 30 天内回复。
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>访问权（第 15 条）：</strong>
            获得有关处理活动的确认以及您的个人数据副本。
          </li>
          <li>
            <strong>更正权（第 16 条）：</strong>更正不准确或不完整的数据。
          </li>
          <li>
            <strong>删除权（第 17 条）：</strong>
            在数据不再必要、您撤回同意、您反对处理或数据遭到非法处理时，请求删除数据。
          </li>
          <li>
            <strong>限制处理权（第 18 条）：</strong>
            在核实准确性期间、处理违法时或等待异议评估时，请求限制处理。
          </li>
          <li>
            <strong>数据可携带权（第 20 条）：</strong>
            以结构化、机器可读格式接收您的数据，并将其传输给另一控制者。
          </li>
          <li>
            <strong>反对权（第 21 条）：</strong>
            反对基于合法利益的处理。您有绝对权利反对直接营销。
          </li>
          <li>
            <strong>自动化决策（第 22 条）：</strong>
            不受仅由自动化方式作出且产生法律或类似重大影响之决定的约束。我们的
            AI 处理用于生成创意内容，不会产生此类影响。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          您可向当地监管机构投诉。完整列表请见{' '}
          <a
            href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            edpb.europa.eu
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-semibold">欧盟代表</h3>
        <p className="mt-4 leading-relaxed">
          根据 GDPR 第 27 条，非欧盟控制者必须在欧盟指定代表。随着我们扩大面向
          EEA
          用户的服务，我们将指定欧盟代表，并在本节更新其联系方式。在此之前，所有隐私咨询均可发送至{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* 14. Your Rights — United States */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          14. 您的权利——美国
        </h2>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>US</JurisdictionTag>{' '}
          美国多个州已制定综合性隐私法，包括加利福尼亚州（CCPA/CPRA）、德克萨斯州（TDPSA）、科罗拉多州、康涅狄格州和弗吉尼亚州等。这些法律是否适用取决于是否达到特定门槛（例如收入、消费者数量或数据销售量）。随着{' '}
          {SITE_CONFIG.name}{' '}
          的发展，我们致力于遵守所有适用的美国州级隐私要求。本节说明我们将为美国用户保障的权利。
        </p>

        <h3 className="mt-6 text-lg font-semibold">14.1 您的权利</h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>知情权/访问权：</strong>
            了解我们收集、使用和披露哪些个人信息，并请求副本。
          </li>
          <li>
            <strong>删除权：</strong>在法律例外范围内请求删除个人信息。
          </li>
          <li>
            <strong>更正权：</strong>请求更正不准确的个人信息。
          </li>
          <li>
            <strong>选择退出出售或共享的权利：</strong>
            我们不会出售个人信息，也不会为跨情境行为广告而共享个人信息。
          </li>
          <li>
            <strong>不受歧视权：</strong>我们不会因您行使权利而歧视您。
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">14.2 如何行使您的权利</h3>
        <p className="mt-4 leading-relaxed">
          请发送电子邮件至{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>{' '}
          提出请求。我们将验证您的身份，并在 45 天内回复。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          14.3 Global Privacy Control
        </h3>
        <p className="mt-4 leading-relaxed">
          我们尊重 Global Privacy Control（GPC）信号。当检测到浏览器发出的 GPC
          信号时，我们会将其视为选择退出出售或共享个人信息的有效请求。
        </p>

        <h3 className="mt-6 text-lg font-semibold">14.4 加利福尼亚州披露</h3>
        <p className="mt-4 leading-relaxed">
          如果达到 CCPA
          门槛，我们将提供完整的加利福尼亚州专项披露，包括所收集和披露的个人信息类别、“请勿出售或共享”机制以及
          CCPA 专项指标。目前我们尚未达到 CCPA 的适用门槛。
        </p>
      </section>

      {/* 15. Statutory Tort for Serious Invasions of Privacy */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          15. 严重侵犯隐私的法定侵权责任
        </h2>
        <p className="mt-4 leading-relaxed">
          自 2025 年 6 月 10
          日起，澳大利亚针对严重侵犯隐私的法定侵权制度（Privacy and Other
          Legislation Amendment Act 2024 附表
          2）赋予个人诉权，使其可在隐私因侵扰独处或滥用个人信息而受到严重侵犯时提起诉讼。无论实体营业额多少，该制度均适用。我们已采取措施防止任何可能构成严重侵犯隐私的行为。
        </p>
      </section>

      {/* 16. Children's Privacy */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">16. 儿童隐私</h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name}{' '}
          并非面向儿童。未经适当同意，我们不会故意收集儿童的个人信息。
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>澳大利亚：</strong>用户必须年满 18
            岁或获得父母同意才能创建账户。我们正在关注澳大利亚 Children&rsquo;s
            Online Privacy Code（将于 2026 年 12 月 10 日前登记）。
          </li>
          <li>
            <strong>欧盟：</strong>
            用户必须达到其成员国规定的最低同意年龄（因国家而异，为 13 至 16
            岁）。低于该年龄者须由父母或监护人同意。
          </li>
          <li>
            <strong>美国：</strong>我们遵守 COPPA，不会故意收集 13
            岁以下儿童的个人信息。FTC 修订后的 COPPA Rule（合规截止日期为 2026
            年 4 月 22 日）扩大了个人信息的定义并加强了保护。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          如果发现我们在未经适当同意的情况下收集了儿童的个人信息，我们将立即删除该信息。
        </p>
      </section>

      {/* 17. Cookies & Tracking Technologies */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          17. Cookie 与跟踪技术
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>严格必要：</strong>用于身份验证和安全保障所必需。
          </li>
          <li>
            <strong>功能性：</strong>记住您的偏好和设置。
          </li>
          <li>
            <strong>分析：</strong>了解用户如何与平台互动。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag> 对于
          EEA/英国用户，仅在获得您事先同意后才会放置非必要 Cookie。您可通过
          Cookie 横幅或账户设置管理偏好。
        </p>
        <p className="mt-4 leading-relaxed">
          您可以通过浏览器设置管理 Cookie。在法律要求的情况下，我们将 Global
          Privacy Control 信号视为 Cookie 退出选择。
        </p>
      </section>

      {/* 18. Notifiable Data Breaches */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          18. 应通知的数据泄露
        </h2>

        <h3 className="mt-6 text-lg font-semibold">
          澳大利亚（Privacy Act 第 IIIC 部分）
        </h3>
        <p className="mt-4 leading-relaxed">
          我们将在 30
          天内评估疑似泄露事件；如果泄露可能造成严重损害，我们会在切实可行的情况下尽快通知
          OAIC 和受影响个人。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          欧盟/EEA（GDPR 第 33 至 34 条）
        </h3>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>GDPR</JurisdictionTag> 我们将在 72
          小时内通知相关监管机构。如果泄露对个人构成高风险，我们也会立即通知受影响的数据主体。
        </p>

        <h3 className="mt-6 text-lg font-semibold">美国</h3>
        <p className="mt-4 leading-relaxed">
          <JurisdictionTag>US</JurisdictionTag>{' '}
          我们将遵守适用的州级数据泄露通知法律。
        </p>
      </section>

      {/* 19. Complaints */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">19. 投诉</h2>
        <p className="mt-4 leading-relaxed">
          如果您认为我们违反了适用的隐私法，请联系{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          。我们将在 5 个工作日内确认收到，并在 30 天内调查和回复。
        </p>
        <p className="mt-4 leading-relaxed">
          如果您对处理结果不满意，可向以下机构申诉：
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            <strong>澳大利亚：</strong>Office of the Australian Information
            Commissioner（OAIC）—{' '}
            <a
              href="https://www.oaic.gov.au"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              www.oaic.gov.au
            </a>{' '}
            &middot; 1300&nbsp;363&nbsp;992 &middot; GPO Box 5218, Sydney NSW
            2001
          </p>
          <p className="mt-2">
            <strong>欧盟/EEA：</strong>您当地的监管机构—{' '}
            <a
              href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              edpb.europa.eu
            </a>
          </p>
          <p className="mt-2">
            <strong>美国：</strong>您所在州的州检察长办公室，或 FTC：{' '}
            <a
              href="https://www.ftc.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              www.ftc.gov
            </a>
          </p>
        </div>
      </section>

      {/* 20. Changes to This Policy */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          20. 本政策的变更
        </h2>
        <p className="mt-4 leading-relaxed">
          我们可能更新本政策，以反映我们的实践、技术或法律要求的变化。重大变更将在我们的网站上发布，并更新“最后更新”日期。在法律要求的情况下，我们会在实质性改变个人信息处理方式前征得您的同意。
        </p>
      </section>

      {/* 21. Contact Us */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">21. 联系我们</h2>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p className="font-semibold">{SITE_CONFIG.name} — 数据控制者</p>
          <p className="mt-1">
            邮箱：{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
          <p className="mt-1">
            网站：{' '}
            <a
              href={SITE_CONFIG.url}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SITE_CONFIG.url}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
