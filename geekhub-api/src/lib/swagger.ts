import { createSwaggerSpec } from "next-swagger-doc";
import packageJson from "../../package.json";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "GeekHub API",
        version: packageJson.version,
        description: "GeekHub API Documentation",
      },
      servers: [
        {
          url: "/",
          description: "Current server",
        },
      ],
    },
  });
  return spec;
};
