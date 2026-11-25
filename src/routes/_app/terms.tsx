import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CONTACT_EMAIL,
  PRIVACY_EMAIL,
  SITE_CONFIG,
} from '@/ui/marketing/constants';

const title = `服务条款 — ${SITE_CONFIG.name}`;

export const Route = createFileRoute('/_app/terms')({
  component: TermsPage,
  head: () => ({
    meta: [
      { title },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${SITE_CONFIG.url}/terms` },
      { name: 'twitter:title', content: title },
    ],
  }),
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        服务条款
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        生效日期：2026 年 3 月 15 日
      </p>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        本服务条款（“条款”）规范您访问和使用由 {SITE_CONFIG.name}
        （“我们”）运营的 {SITE_CONFIG.name}
        平台、网站和服务（统称“服务”）。访问或使用服务即表示您同意受本条款约束。如果您不同意，则不得使用服务。
      </p>

      {/* 1. The Service */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">1. 服务</h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name} 是一个由 AI
          驱动的视频生成平台，使用户能够利用人工智能创作视频内容。服务可能包括剧本分析、场景生成、角色提取、图像生成、视频渲染及相关功能。
        </p>
        <p className="mt-4 leading-relaxed">
          我们使用第三方 AI
          模型和基础设施为部分服务提供支持。服务的可用性和功能可能取决于这些第三方服务商。我们保留随时修改、暂停或终止服务任何部分的权利。在合理可行的情况下，对于影响您使用服务的重大变更，我们会提前通知。
        </p>
      </section>

      {/* 2. Account Registration */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">2. 账户注册</h2>
        <p className="mt-4 leading-relaxed">
          要使用服务的部分功能，您必须创建账户。您同意在注册时提供准确、最新且完整的信息，并保持账户信息更新。您应自行负责保护账户凭据的机密性，并对账户下发生的所有活动负责。如果发现账户遭到未经授权的使用，您必须立即通知我们。
        </p>
        <p className="mt-4 leading-relaxed">
          您必须年满 18
          岁才能创建账户。我们可能实施年龄验证措施；如果有合理理由认为账户持有人不符合此年龄要求，我们保留暂停或终止账户的权利。对于违反本条款的账户，我们也保留暂停或终止的权利。
        </p>
      </section>

      {/* 3. Credits, Payments & Billing */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          3. 点数、付款与计费
        </h2>
        <p className="mt-4 leading-relaxed">
          服务采用基于点数的计费模式。使用包括视频生成在内的部分功能需要消耗点数。您可通过服务按购买时显示的价格购买点数。
        </p>

        <h3 className="mt-6 text-lg font-semibold">退款政策</h3>
        <p className="mt-4 leading-relaxed">
          点数一经购买通常不予退款。根据我们的商业政策，我们通常不对未使用的点数提供退款或兑换。
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            本条款的任何内容均不排除、限制或修改您依据 Australian Consumer Law（
            <em>Competition and Consumer Act 2010</em> (Cth) 附表
            2）或其他任何不得通过协议排除的适用法律所享有的权利或救济。如果服务未达到消费者保障要求，您可能有权获得包括退款在内的救济。
          </p>
        </div>

        <h3 className="mt-6 text-lg font-semibold">点数有效期</h3>
        <p className="mt-4 leading-relaxed">
          点数自购买之日起 12 个月后到期。我们将尽合理努力，在点数到期前至少 30
          天通过电子邮件通知您。到期后，任何未使用的点数将失效，且无法恢复或转让。点数有效期也会在购买时显示。
        </p>

        <h3 className="mt-6 text-lg font-semibold">价格变更</h3>
        <p className="mt-4 leading-relaxed">
          我们保留随时更改点数价格的权利。任何价格变更均不影响已购买的点数。我们会至少提前
          14
          天通知价格变更。点数不具有现金价值，不得在平台之外转让、出售或兑换。
        </p>
      </section>

      {/* 4. Acceptable Use */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">4. 可接受使用</h2>
        <p className="mt-4 leading-relaxed">您同意不将服务用于：</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>生成违法、诽谤、淫秽、有害或侵犯任何第三方权利的内容</li>
          <li>未经真实个人同意，制作冒充该个人的深度伪造或误导性内容</li>
          <li>
            生成对未成年人进行色情化，或以任何方式助长剥削或虐待儿童的内容
          </li>
          <li>
            在没有真实且可识别个人书面授权（明确涵盖 AI
            生成）的情况下，上传该个人的图像、视频或声音录音，或基于此类素材进行生成。您应自行负责持有该授权，并须能应要求出示
          </li>
          <li>传播垃圾信息或恶意软件，或以任何形式滥用服务或骚扰服务用户</li>
          <li>
            试图对服务进行逆向工程、反编译，或提取其底层模型、算法或源代码
          </li>
          <li>规避服务的使用限制、访问控制或任何技术限制</li>
          <li>以任何可能损坏、禁用或削弱服务的方式使用服务</li>
          <li>
            以违反适用法律的方式使用生成内容，包括有关误导或欺骗行为的法律
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          如果我们有合理理由认为您违反本节，我们保留暂停或终止您访问权限的权利。在可行的情况下，我们会告知您具体违规行为，并在终止前给予补救机会，严重或反复违规的情形除外。
        </p>

        <h3 className="mt-6 text-lg font-semibold">举报违规行为</h3>
        <p className="mt-4 leading-relaxed">
          任何人（包括没有我们账户的人）均可通过{' '}
          <Link to="/report" className="underline">
            {SITE_CONFIG.url}/report
          </Link>
          举报服务上生成的内容，或发送电子邮件至{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          。对于已接入追溯机制的生成任务，我们会记录账户、模型和提示词哈希（不记录提示词文本），以便将被举报内容追溯至来源。这涵盖生成的静态画面、动态片段、设定图、音乐、直接模型访问资产和故事序列导出。用户上传的参考照片记录为权利保证，而非生成内容。有关儿童性虐待材料和未经同意使用他人肖像的举报将作为紧急事项处理。举报一经查实，我们将移除相关内容，并对责任账户施加限制，最高可关闭账户。
        </p>
      </section>

      {/* 5. Intellectual Property */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">5. 知识产权</h2>

        <h3 className="mt-6 text-lg font-semibold">您的内容</h3>
        <p className="mt-4 leading-relaxed">
          您保留对提交给服务的任何原创内容（剧本、图像、提示词）的所有权（“输入内容”）。提交输入内容即表示您授予我们有限的、非独占的、全球性的许可，仅为向您提供服务之目的处理、存储和使用您的输入内容。除非您另行明确同意，否则我们不会使用您的输入内容训练或改进
          AI 模型。
        </p>

        <h3 className="mt-6 text-lg font-semibold">生成内容</h3>
        <p className="mt-4 leading-relaxed">
          在遵守本条款的前提下，我们将我们对服务基于您的输入内容生成的输出（“生成内容”）所拥有的任何权利全部转让给您。您理解，AI
          生成内容的法律地位仍在发展，部分生成内容可能无法依据澳大利亚法律或其他司法管辖区法律获得著作权保护。您应自行负责确保对生成内容的使用符合适用法律，且不侵犯任何第三方权利。
        </p>
        <p className="mt-4 leading-relaxed">
          由于 AI
          模型可能对相似输入产生相似输出，我们不保证生成内容为您所独有。我们无法就生成内容提供不侵权保证。
        </p>

        <h3 className="mt-6 text-lg font-semibold">我们的平台</h3>
        <p className="mt-4 leading-relaxed">
          服务（包括其软件、模型、设计、品牌和文档）的所有权利、所有权权益均归{' '}
          {SITE_CONFIG.name}
          所有。未经我们事先书面同意，本条款不授予您使用我们的商标、徽标或品牌资产的任何权利。
        </p>
      </section>

      {/* 6. AI Transparency */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">6. AI 透明度</h2>
        <p className="mt-4 leading-relaxed">
          服务使用人工智能（包括第三方 AI 模型）生成视频内容。您应了解以下事项：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>AI 的使用方式：</strong>
            当您提交输入内容（例如剧本或提示词）时，我们的系统会使用 AI
            模型进行处理，以生成场景、角色、图像和视频。分析您的输入和制作生成内容的过程中会使用自动化流程。
          </li>
          <li>
            <strong>局限性：</strong>AI
            生成内容可能包含不准确之处、视觉瑕疵、偏见或意外结果。生成内容的质量和准确性可能不同。您有责任在使用或分发前审查所有输出。
          </li>
          <li>
            <strong>第三方服务商：</strong>我们可能使用第三方 AI
            模型和云基础设施交付服务。这些服务商在数据处理方面受合同义务约束。
          </li>
          <li>
            <strong>不使用您的内容训练：</strong>
            除非您另行明确选择同意，否则我们不会使用您的输入内容或生成内容训练或改进
            AI 模型。
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          我们致力于按照澳大利亚 AI Ethics Principles 负责任地使用
          AI，并将随着监管环境发展更新这些披露。
        </p>
      </section>

      {/* 7. Privacy & Data Protection */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          7. 隐私与数据保护
        </h2>
        <p className="mt-4 leading-relaxed">
          您对服务的使用还受我们的{' '}
          <Link
            to="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            隐私政策
          </Link>
          约束，其中说明我们如何收集、使用、存储和披露您的个人信息。使用服务即表示您确认已阅读并理解我们的隐私政策。
        </p>

        <h3 className="mt-6 text-lg font-semibold">数据处理</h3>
        <p className="mt-4 leading-relaxed">
          在提供服务的过程中，我们会处理您提交的输入内容（包括剧本、图像和提示词），并据此生成视频内容。只要您的账户有效，我们就会保留您的输入内容和生成内容，隐私政策另有说明的除外。您可联系我们请求删除您的内容。
        </p>

        <h3 className="mt-6 text-lg font-semibold">国际数据传输</h3>
        <p className="mt-4 leading-relaxed">
          服务可能涉及将您的数据传输到位于澳大利亚境外的服务器和第三方服务商。向境外传输个人信息时，我们会采取合理措施，确保接收方按照
          Australian Privacy Principles 处理您的信息，并实施适当的合同保障。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          欧洲经济区（EEA）或英国用户
        </h3>
        <p className="mt-4 leading-relaxed">
          如果您位于 EEA 或英国，以下附加规定适用：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>合法依据：</strong>
            我们基于合同必要性（提供服务）、合法利益（改进和保护服务）以及同意（在您已提供同意的情况下）处理您的个人数据。
          </li>
          <li>
            <strong>您的权利：</strong>
            您有权访问、更正、删除、限制处理和携带您的个人数据。您还有权反对处理并随时撤回同意。要行使这些权利，请通过以下邮箱联系我们：{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {PRIVACY_EMAIL}
            </a>
            .
          </li>
          <li>
            <strong>国际传输：</strong>将您的个人数据传输到 EEA
            或英国以外地区时，我们依赖适当保障，例如经 European Commission
            或英国主管机构批准的 Standard Contractual Clauses。
          </li>
          <li>
            <strong>监管机构：</strong>您有权向当地数据保护监管机构投诉。
          </li>
        </ul>
      </section>

      {/* 8. Disclaimers */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">8. 免责声明</h2>
        <p className="mt-4 leading-relaxed">
          在适用法律允许的范围内，服务按“现状”和“可用”基础提供。我们不保证服务不会中断、没有错误或不含有害组件。
        </p>
        <p className="mt-4 leading-relaxed">
          AI
          生成内容可能包含不准确之处、瑕疵或意外结果。您确认生成内容的质量和准确性可能不同，并有责任在使用前审查所有输出。
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            本节任何内容均不排除或限制 Australian Consumer Law
            规定的任何消费者保障，或任何不得通过协议排除或限制的其他法定权利或救济。在
            Australian Consumer Law
            适用时，对于违反不可排除的消费者保障所承担的责任，在法律允许的范围内仅限于重新提供服务或支付重新提供服务的费用。
          </p>
        </div>
      </section>

      {/* 9. Limitation of Liability */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">9. 责任限制</h2>
        <p className="mt-4 leading-relaxed">
          在适用法律允许的最大范围内，{SITE_CONFIG.name}
          及其高级职员、董事、员工和代理人不对因您使用服务而产生或与之相关的任何间接、附带、特殊、后果性或惩罚性损害承担责任，包括利润、数据或商誉损失。
        </p>
        <p className="mt-4 leading-relaxed">
          对于本条款项下产生的任何索赔，我们承担的累计责任总额不得超过导致索赔之事件发生前十二（12）个月内您向我们支付的金额。
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            本限制不适用于 Australian Consumer Law 下不得排除或限制的责任，包括
            ACL
            所定义重大故障的责任。如果服务供应发生重大故障，您有权取消合同并获得退款，或就已提供服务价值的降低寻求赔偿。
          </p>
        </div>
      </section>

      {/* 10. Indemnification */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">10. 赔偿</h2>
        <p className="mt-4 leading-relaxed">
          您同意就以下事项引起或与之相关的任何索赔、损失、损害、责任和费用（包括合理律师费），对{' '}
          {SITE_CONFIG.name} 及其关联方进行赔偿、抗辩并使其免受损害：(a)
          您违反本条款使用服务；(b) 您违反任何适用法律；或 (c)
          您侵犯任何第三方权利，包括通过您的输入内容或对生成内容的使用而造成的侵权。
        </p>
        <p className="mt-4 leading-relaxed">
          如果索赔因我们自身的疏忽、故意不当行为或违反本条款而产生，则在相应范围内不适用上述赔偿义务。
        </p>
      </section>

      {/* 11. Termination */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">11. 终止</h2>

        <h3 className="mt-6 text-lg font-semibold">
          {SITE_CONFIG.name} 因故终止
        </h3>
        <p className="mt-4 leading-relaxed">
          如果您严重违反本条款（包括可接受使用政策），我们可能暂停或终止您访问服务。在可行的情况下，我们会在终止前通知您并给予合理机会补救违约，但涉及严重或反复违规、违法活动或可能对其他用户或服务造成损害的情况除外。
        </p>
        <p className="mt-4 leading-relaxed">
          因故终止后，您使用服务的权利立即终止。因故终止时任何未使用的点数将失效。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          {SITE_CONFIG.name} 无故终止
        </h3>
        <p className="mt-4 leading-relaxed">
          我们可出于任何原因，在至少提前 30
          天书面通知您的情况下停止向您提供服务。如果我们无故终止您的账户，将按比例退还或补偿已购买、尚未使用且未到期的点数。
        </p>

        <h3 className="mt-6 text-lg font-semibold">由您终止</h3>
        <p className="mt-4 leading-relaxed">
          您可随时通过以下邮箱联系我们以关闭账户：{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {CONTACT_EMAIL}
          </a>
          。根据我们的商业政策，您自愿关闭账户时点数不予退款，但这不影响您依据
          Australian Consumer Law 或其他适用法律可能享有的任何权利。
        </p>

        <h3 className="mt-6 text-lg font-semibold">继续有效</h3>
        <p className="mt-4 leading-relaxed">
          本条款中按其性质应在终止后继续有效的部分将继续有效，包括知识产权、责任限制、赔偿和争议解决条款。
        </p>
      </section>

      {/* 12. Dispute Resolution */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">12. 争议解决</h2>

        <h3 className="mt-6 text-lg font-semibold">非正式解决</h3>
        <p className="mt-4 leading-relaxed">
          如果您对服务存在争议或投诉，我们建议您先通过以下邮箱联系我们：{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {CONTACT_EMAIL}
          </a>
          。我们将尽力在 14 个工作日内解决您的问题。
        </p>

        <h3 className="mt-6 text-lg font-semibold">调解</h3>
        <p className="mt-4 leading-relaxed">
          如果无法通过非正式方式解决争议，任何一方均可根据 ADC Mediation
          Guidelines，将争议提交给位于新南威尔士州悉尼的 Australian Disputes
          Centre（ADC）进行调解。调解费用由双方平均承担。
        </p>

        <h3 className="mt-6 text-lg font-semibold">法院诉讼</h3>
        <p className="mt-4 leading-relaxed">
          如果争议在提交调解后 30
          天内（或双方约定的更长期限内）未能解决，任何一方均可提起法院诉讼。本节任何内容均不妨碍任何一方随时向有管辖权的法院寻求紧急临时救济。
        </p>
        <p className="mt-4 leading-relaxed">
          本节任何内容均不限制您向相关监管机构投诉的权利，包括 Australian
          Competition and Consumer
          Commission（ACCC）、州或领地消费者保护机构，或 Office of the
          Australian Information Commissioner（OAIC）。
        </p>
      </section>

      {/* 13. Changes to These Terms */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          13. 本条款的变更
        </h2>
        <p className="mt-4 leading-relaxed">
          我们可能不时更新本条款。对于轻微或非实质性变更，我们会更新生效日期，并在服务上发布修订后的条款。
        </p>
        <p className="mt-4 leading-relaxed">
          对于重大变更，包括影响定价、点数有效期、您的权利或服务核心功能的变更，我们将：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>在变更生效前至少 30 天通过电子邮件通知您</li>
          <li>清楚说明所作变更</li>
          <li>如果您不同意变更，为您提供在变更生效前关闭账户的选择</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          如果您因不接受本条款的重大变更而关闭账户，我们将按比例退还或补偿已购买、尚未使用且未到期的点数。
        </p>
        <p className="mt-4 leading-relaxed">
          在任何变更生效日期后继续使用服务，即表示您接受修订后的条款。
        </p>
      </section>

      {/* 14. Governing Law */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">14. 管辖法律</h2>
        <p className="mt-4 leading-relaxed">
          本条款受澳大利亚新南威尔士州法律管辖并据其解释，不考虑其法律冲突原则。在遵守第
          12
          节争议解决程序的前提下，因本条款产生或与本条款相关的任何争议，均受澳大利亚新南威尔士州法院的非专属管辖。
        </p>
      </section>

      {/* 15. Australian Consumer Law */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          15. 澳大利亚消费者法
        </h2>
        <p className="mt-4 leading-relaxed">
          本条款无意排除、限制或修改您依据 Australian Consumer Law（
          <em>Competition and Consumer Act 2010</em> (Cth) 附表
          2）或其他任何不得通过协议排除的适用法律所享有的消费者保障或权利。如果本条款的任何规定与任何不可排除的法定权利不一致，则该规定应在不一致的范围内作限缩解释或予以分割。
        </p>
      </section>

      {/* 16. General */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">16. 一般规定</h2>
        <p className="mt-4 leading-relaxed">
          <strong>可分割性。</strong>
          如果本条款的任何规定被认定为无效或不可执行，该规定将在允许的最大范围内执行，其余规定仍将保持完全有效。
        </p>
        <p className="mt-4 leading-relaxed">
          <strong>完整协议。</strong>本条款与隐私政策共同构成您与{' '}
          {SITE_CONFIG.name} 之间有关服务的完整协议，并取代此前所有协议和谅解。
        </p>
        <p className="mt-4 leading-relaxed">
          <strong>不放弃权利。</strong>
          我们未执行本条款中的任何权利或规定，不应被视为放弃该权利或规定。
        </p>
        <p className="mt-4 leading-relaxed">
          <strong>转让。</strong>
          未经我们事先书面同意，您不得转让本条款项下的权利或义务。我们可因合并、收购或资产出售而转让本条款项下的权利和义务，但受让方须同意受本条款约束。
        </p>
      </section>

      {/* 17. Contact */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">17. 联系方式</h2>
        <p className="mt-4 leading-relaxed">
          如果您对本条款有任何疑问，请通过以下方式联系我们：
        </p>
        <p className="mt-4 leading-relaxed">
          <strong>一般咨询：</strong>{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-2 leading-relaxed">
          <strong>隐私咨询：</strong>{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
