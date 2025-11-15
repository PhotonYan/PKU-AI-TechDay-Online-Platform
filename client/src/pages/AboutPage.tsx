const AboutPage = () => (
  <div className="bg-white rounded shadow p-6 space-y-4">
    <header>
      <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">About</p>
      <p className="text-slate-600 mt-0.5"></p>
      <h1 className="text-3xl font-bold text-slate-900 mt-1">关于平台</h1>
      <div className="my-8"></div>
      {/* <p className="text-slate-600 mt-2">
        这里是 AI TechDay Online Platform 的占位页面，可用于未来添加菜单、介绍或其他内容。
      </p> */}
    </header>
    <p className="text-1.2xl text-red-700 font-semibold">
      恭喜你发现了彩蛋~
    </p>
    <p className="text-sm text-slate-600">
      This is a work produced by{" "}
      <a
        href="https://github.com/PhotonYan"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
      >
        PhotonYan
      </a>
      , Nov. 2025, after AI Tech Day 2025.
    </p>
    {/* <section className="text-sm text-slate-600 space-y-3">
      <p>您可以在此处补充科技节背景、组织架构、联系我们等信息。</p>
      <div className="border rounded-lg p-4 bg-slate-50">
        <h2 className="font-semibold text-slate-800 mb-2">可放置的内容示例</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>平台愿景与使命</li>
          <li>往届精彩瞬间或数据</li>
          <li>常见问题（FAQ）</li>
        </ul>
      </div>
    </section> */}
  </div>
);

export default AboutPage;
