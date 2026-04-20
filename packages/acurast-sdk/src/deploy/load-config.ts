import fs from 'fs'
import type {
  AcurastCliConfig,
  AcurastProjectConfig,
} from '../types/project.js'

/**
 * Load a named project entry from an `acurast.json` file.
 *
 * If `project` is omitted and the file contains exactly one project, that
 * project is returned. Otherwise an error is thrown listing the available
 * project names.
 */
export const loadAcurastConfig = (options: {
  filePath?: string
  project?: string
} = {}): AcurastProjectConfig | undefined => {
  const filePath = options.filePath ?? './acurast.json'
  if (!fs.existsSync(filePath)) {
    throw new Error(`${filePath} not found`)
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const config: AcurastCliConfig = JSON.parse(fileContent)

  if (!options.project) {
    const projects = Object.keys(config.projects)

    if (projects.length === 1) {
      return config.projects[projects[0]]
    }
    if (projects.length === 0) {
      throw new Error(`No projects found in ${filePath}`)
    }
    throw new Error(
      `Project not specified. Available projects: ${projects.join(', ')}`
    )
  }

  if (config.projects[options.project]) {
    return config.projects[options.project]
  }

  throw new Error(`Project "${options.project}" not found in ${filePath}`)
}
