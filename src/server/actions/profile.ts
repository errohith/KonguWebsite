"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/http/action";
import { assertActionUser } from "@/server/modules/auth/current";
import * as media from "@/server/modules/media/service";
import { PROFILE_STEPS, type ProfileStep } from "@/server/modules/profiles/schemas";
import { saveProfileStep, submitProfile } from "@/server/modules/profiles/service";
import { getEnv } from "@/server/config/env";

function nextStep(step: ProfileStep): ProfileStep | null {
  const steps = PROFILE_STEPS.filter((s) => s !== "horoscope" || getEnv().ENABLE_HOROSCOPE_FEATURE);
  const i = steps.indexOf(step);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export async function saveStepAction(step: ProfileStep, _: ActionState, form: FormData): Promise<ActionState> {
  let goTo: string | null = null;
  const state = await runAction(async () => {
    if (!PROFILE_STEPS.includes(step)) throw new Error("unknown step");
    const user = await assertActionUser();
    await saveProfileStep(user.id, step, formToObject(form));
    const next = nextStep(step);
    if (form.get("intent") === "next" && next) goTo = `/profile/edit/${next}`;
    return "profile.saved";
  });
  if (goTo) redirect(goTo);
  refresh();
  return state;
}

export async function submitProfileAction(_: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    const status = await submitProfile(user.id);
    refresh();
    return status === "PUBLISHED" ? "profile.published" : "profile.submittedReview";
  });
}

export async function uploadPhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    await media.uploadPhoto(user.id, form.get("photo") as File);
    refresh();
    return "profile.saved";
  });
}

export async function deletePhotoAction(photoId: string) {
  const user = await assertActionUser();
  await media.deletePhoto(user.id, photoId);
  refresh();
}

export async function setPrimaryPhotoAction(photoId: string) {
  const user = await assertActionUser();
  await media.setPrimaryPhoto(user.id, photoId);
  refresh();
}
