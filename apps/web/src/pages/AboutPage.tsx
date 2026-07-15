import { useEffect } from 'react';
import { Github, HeartHandshake, Network, Palette, Server, ShieldCheck } from 'lucide-react';
import { projectConfig } from '../config/project';

export function AboutPage() {
  useEffect(() => { document.title = `关于 · ${projectConfig.name}`; }, []);

  return (
    <article className="about-page">
      <span className="eyebrow">个人项目</span>
      <h1>关于 {projectConfig.name}</h1>
      <p className="lead">{projectConfig.description}。项目从前后端边界开始设计，参考前端可以被整体替换，API 契约保持稳定。</p>
      {projectConfig.ownerName && (
        <p className="project-owner">
          维护者：{projectConfig.ownerUrl
            ? <a href={projectConfig.ownerUrl} target="_blank" rel="noreferrer">{projectConfig.ownerName}</a>
            : <strong>{projectConfig.ownerName}</strong>}
        </p>
      )}
      <div className="about-grid">
        <section><ShieldCheck /><h2>本地优先</h2><p>图片、文本和校验类工具默认只在浏览器处理，降低隐私风险和等待时间。</p></section>
        <section><Server /><h2>独立后端</h2><p>PDF、Office 与 OCR 经过受限 API 转发，上游地址、限流和文件限制不会暴露给前端。</p></section>
        <section><Network /><h2>稳定契约</h2><p>共享类型和 OpenAPI 文档让任何前端都能重新接入，不绑定当前 React 页面。</p></section>
        <section><Palette /><h2>集中定制</h2><p>名称、说明、仓库、API 地址和功能入口都有明确配置位置。</p></section>
      </div>
      {(projectConfig.repositoryUrl || projectConfig.supportUrl) && (
        <div className="about-actions">
          {projectConfig.repositoryUrl && <a className="primary-button inline-button" href={projectConfig.repositoryUrl} target="_blank" rel="noreferrer"><Github size={18} /> 查看项目源码</a>}
          {projectConfig.supportUrl && <a className="secondary-button inline-button" href={projectConfig.supportUrl} target="_blank" rel="noreferrer"><HeartHandshake size={18} /> 支持项目</a>}
        </div>
      )}
    </article>
  );
}
