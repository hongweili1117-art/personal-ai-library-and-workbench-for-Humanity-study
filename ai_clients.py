"""AI 客户端层：文本/流式对话、视觉(OCR/看图)、SSE 流封装、引擎与 Key 解析。
封装 OpenAI / Anthropic / 各 OpenAI 兼容供应商。由 app.py 通过 `from ai_clients import *` 引入。"""
import json

from flask import Response

from config import *

__all__ = ['llm_chat', 'llm_chat_stream', 'sse_stream', 'llm_call',
           'vision_ocr', 'vision_chat', 'resolve_key']


def _msg_text(resp):
    """兼容 OpenAI Responses / Chat Completions 的文本提取。"""
    if hasattr(resp, "output_text") and resp.output_text:
        return resp.output_text.strip()
    try:
        return resp.choices[0].message.content.strip()
    except Exception:
        pass
    parts = []
    try:
        for item in getattr(resp, "output", []) or []:
            if getattr(item, "type", "") == "message":
                for c in getattr(item, "content", []) or []:
                    txt = getattr(c, "text", None)
                    if txt:
                        parts.append(txt)
    except Exception:
        pass
    return "\n".join(parts).strip()


def _openai_compatible_chat(api_key, base_url, model, system, messages):
    from openai import OpenAI
    cli = OpenAI(api_key=api_key, base_url=base_url)
    r = cli.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}] + messages,
    )
    return r.choices[0].message.content.strip()


def _openai_responses_chat(api_key, model, system, messages, effort=None):
    from openai import OpenAI
    cli = OpenAI(api_key=api_key)
    kwargs = {
        "model": model,
        "instructions": system,
        "input": messages,
    }
    if effort and effort != "default":
        kwargs["reasoning"] = {"effort": effort}
    try:
        r = cli.responses.create(**kwargs)
        return _msg_text(r)
    except Exception:
        # 兼容旧版 openai SDK 或暂不支持 Responses API 的环境。
        r = cli.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}] + messages,
        )
        return r.choices[0].message.content.strip()


def llm_chat(provider, api_key, system, messages, model=None, effort=None, base_url=None):
    if provider == "OpenAI":
        return _openai_responses_chat(api_key, model or OPENAI_MODEL, system, messages, effort=effort)

    if provider in OPENAI_COMPAT:
        b, m = OPENAI_COMPAT[provider]
        return _openai_compatible_chat(api_key, b, model or m, system, messages)

    if provider == "CustomOpenAI":
        if not base_url:
            raise ValueError("自定义 OpenAI 兼容接口需要填写 Base URL")
        return _openai_compatible_chat(api_key, base_url, model or "", system, messages)

    if provider == "Claude":
        import anthropic
        cli = anthropic.Anthropic(api_key=api_key)
        kwargs = dict(model=model or CLAUDE_MODEL, max_tokens=6000,
                      system=system, messages=messages)
        if effort and effort != "default":
            kwargs["output_config"] = {"effort": effort}
        try:
            m = cli.messages.create(**kwargs)
        except TypeError:
            # 兼容旧版 anthropic SDK：旧 SDK 不认识 output_config。
            kwargs.pop("output_config", None)
            m = cli.messages.create(**kwargs)
        return "".join(b.text for b in m.content if getattr(b, "type", "") == "text").strip()

    raise ValueError("未知引擎")



def llm_chat_stream(provider, api_key, system, messages, model=None, effort=None, base_url=None):
    """生成文本流。优先使用供应商 stream；失败时退回一次性输出并分块返回。"""
    try:
        if provider == "OpenAI" or provider == "CustomOpenAI" or provider in OPENAI_COMPAT:
            from openai import OpenAI
            if provider == "OpenAI":
                cli = OpenAI(api_key=api_key)
                use_model = model or OPENAI_MODEL
            elif provider == "CustomOpenAI":
                if not base_url:
                    raise ValueError("自定义 OpenAI 兼容接口需要填写 Base URL")
                cli = OpenAI(api_key=api_key, base_url=base_url)
                use_model = model or ""
            else:
                b, m = OPENAI_COMPAT[provider]
                cli = OpenAI(api_key=api_key, base_url=b)
                use_model = model or m
            stream = cli.chat.completions.create(
                model=use_model,
                messages=[{"role": "system", "content": system}] + messages,
                stream=True,
            )
            for chunk in stream:
                try:
                    delta = chunk.choices[0].delta.content
                except Exception:
                    delta = None
                if delta:
                    yield delta
            return
        if provider == "Claude":
            import anthropic
            cli = anthropic.Anthropic(api_key=api_key)
            kwargs = dict(model=model or CLAUDE_MODEL, max_tokens=6000, system=system, messages=messages)
            if effort and effort != "default":
                kwargs["output_config"] = {"effort": effort}
            try:
                with cli.messages.stream(**kwargs) as stream:
                    for text in stream.text_stream:
                        if text:
                            yield text
                return
            except TypeError:
                kwargs.pop("output_config", None)
                with cli.messages.stream(**kwargs) as stream:
                    for text in stream.text_stream:
                        if text:
                            yield text
                return
    except Exception:
        pass
    # 最后兜底：一次性调用，再切成小段发给前端。
    text = llm_chat(provider, api_key, system, messages, model=model, effort=effort, base_url=base_url)
    for i in range(0, len(text), 120):
        yield text[i:i+120]


def sse_stream(chunks):
    def gen():
        try:
            for ch in chunks:
                yield "data: " + json.dumps({"delta": ch}, ensure_ascii=False) + "\n\n"
            yield "data: " + json.dumps({"done": True}, ensure_ascii=False) + "\n\n"
        except Exception as e:
            yield "data: " + json.dumps({"error": str(e)}, ensure_ascii=False) + "\n\n"
    return Response(gen(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

def llm_call(provider, api_key, system, user, model=None, effort=None, base_url=None):
    return llm_chat(provider, api_key, system, [{"role": "user", "content": user}],
                    model=model, effort=effort, base_url=base_url)


def vision_ocr(provider, api_key, model, b64png, effort=None, base_url=None, task="text"):
    """把一张 PNG（base64）发给会看图的模型。
    task: text=提取文字 / translate=翻译成中文 / explain=解读图表 / formula=公式转LaTeX。"""
    instr = OCR_TASK_PROMPTS.get(task, OCR_TASK_PROMPTS["text"])

    if provider == "OpenAI":
        from openai import OpenAI
        cli = OpenAI(api_key=api_key)
        kwargs = {
            "model": model or OPENAI_MODEL,
            "input": [{"role": "user", "content": [
                {"type": "input_text", "text": instr},
                {"type": "input_image", "image_url": "data:image/png;base64," + b64png},
            ]}],
        }
        if effort and effort != "default":
            kwargs["reasoning"] = {"effort": effort}
        r = cli.responses.create(**kwargs)
        return _msg_text(r)

    if provider == "Claude":
        import anthropic
        cli = anthropic.Anthropic(api_key=api_key)
        kwargs = dict(model=model or CLAUDE_MODEL, max_tokens=4000, messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                          "media_type": "image/png", "data": b64png}},
                {"type": "text", "text": instr},
            ],
        }])
        if effort and effort != "default":
            kwargs["output_config"] = {"effort": effort}
        try:
            m = cli.messages.create(**kwargs)
        except TypeError:
            kwargs.pop("output_config", None)
            m = cli.messages.create(**kwargs)
        return "".join(b.text for b in m.content if getattr(b, "type", "") == "text").strip()

    # 通义千问 / 智谱 GLM / Kimi / DeepSeek / 自定义：均走 OpenAI 兼容的看图接口。
    # 未显式选模型时，自动套用各家的默认视觉模型（如 qwen3-vl-plus、glm-4.6v）。
    if provider in OPENAI_COMPAT or provider == "CustomOpenAI":
        from openai import OpenAI
        if provider == "CustomOpenAI":
            if not base_url:
                raise ValueError("自定义 OpenAI 兼容接口需要填写 Base URL")
            cli = OpenAI(api_key=api_key, base_url=base_url)
            use_model = model or ""
        else:
            b, _m = OPENAI_COMPAT[provider]
            cli = OpenAI(api_key=api_key, base_url=b)
            use_model = model or VISION_DEFAULT_MODEL.get(provider, _m)
        r = cli.chat.completions.create(
            model=use_model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": instr},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64png}},
            ]}],
        )
        return r.choices[0].message.content.strip()

    raise ValueError("OCR 需要支持图片输入的模型，建议用 通义千问 / 智谱GLM / Kimi / OpenAI / Claude")


def vision_chat(provider, api_key, model, b64png, instruction, effort=None, base_url=None):
    """把一张 PNG（base64）连同【自定义指令】发给会看图的模型。
    与 vision_ocr 的区别：指令可定制（用于公式/图表解析等），不写死成纯 OCR。
    供 AI 智库的“视觉解析”复用同一套供应商与密钥分发。"""
    if provider == "OpenAI":
        from openai import OpenAI
        cli = OpenAI(api_key=api_key)
        kwargs = {
            "model": model or OPENAI_MODEL,
            "input": [{"role": "user", "content": [
                {"type": "input_text", "text": instruction},
                {"type": "input_image", "image_url": "data:image/png;base64," + b64png},
            ]}],
        }
        if effort and effort != "default":
            kwargs["reasoning"] = {"effort": effort}
        r = cli.responses.create(**kwargs)
        return _msg_text(r)

    if provider == "Claude":
        import anthropic
        cli = anthropic.Anthropic(api_key=api_key)
        kwargs = dict(model=model or CLAUDE_MODEL, max_tokens=4000, messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                          "media_type": "image/png", "data": b64png}},
                {"type": "text", "text": instruction},
            ],
        }])
        if effort and effort != "default":
            kwargs["output_config"] = {"effort": effort}
        try:
            m = cli.messages.create(**kwargs)
        except TypeError:
            kwargs.pop("output_config", None)
            m = cli.messages.create(**kwargs)
        return "".join(b.text for b in m.content if getattr(b, "type", "") == "text").strip()

    if provider in OPENAI_COMPAT or provider == "CustomOpenAI":
        from openai import OpenAI
        if provider == "CustomOpenAI":
            if not base_url:
                raise ValueError("自定义 OpenAI 兼容接口需要填写 Base URL")
            cli = OpenAI(api_key=api_key, base_url=base_url)
            use_model = model or ""
        else:
            b, _m = OPENAI_COMPAT[provider]
            cli = OpenAI(api_key=api_key, base_url=b)
            use_model = model or VISION_DEFAULT_MODEL.get(provider, _m)
        r = cli.chat.completions.create(
            model=use_model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": instruction},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64png}},
            ]}],
        )
        return r.choices[0].message.content.strip()

    raise ValueError("视觉解析需要支持图片输入的模型，建议用 通义千问 / 智谱GLM / Kimi / OpenAI / Claude")


def resolve_key(d):
    """只使用当前请求携带的 key；已移除朋友共享 API Key 功能。"""
    return d.get("provider", "DeepSeek"), d.get("api_key", "")


