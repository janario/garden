/*
 * Copyright (C) 2018-2020 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { GetServiceLogsParams } from "../../../types/plugin/service/getServiceLogs"
import { getAllLogs } from "../logs"
import { HelmModule } from "./config"
import { KubernetesPluginContext } from "../config"
import { getChartResources } from "./common"
import { getModuleNamespace } from "../namespace"

export async function getServiceLogs(params: GetServiceLogsParams<HelmModule>) {
  const { ctx, module, log } = params
  const k8sCtx = <KubernetesPluginContext>ctx
  const provider = k8sCtx.provider
  const namespace = await getModuleNamespace({
    ctx: k8sCtx,
    log,
    module,
    provider: k8sCtx.provider,
  })

  const resources = await getChartResources(k8sCtx, module, false, log)

  return getAllLogs({ ...params, provider, defaultNamespace: namespace, resources })
}
