import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ForgotPasswordForm,
  LoginForm,
  ResetPasswordForm,
  SignUpForm,
} from "../components/auth/auth-forms";

test("server-rendered auth forms cannot submit credentials in a GET URL before hydration", () => {
  for (const Component of [LoginForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm]) {
    const html = renderToStaticMarkup(createElement(Component));
    const forms = html.match(/<form\b[^>]*>/g) ?? [];
    const submitButtons = html.match(/<button\b[^>]*type="submit"[^>]*>/g) ?? [];
    assert.ok(forms.length > 0, Component.name);
    assert.ok(submitButtons.length > 0, Component.name);
    for (const form of forms) assert.match(form, /method="post"/, Component.name);
    for (const button of submitButtons) assert.match(button, /\bdisabled=""/, Component.name);
  }
});
