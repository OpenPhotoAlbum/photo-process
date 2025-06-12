import { Request, Response } from 'express';
import path from 'path';

export const Root = async (request: Request, response: Response) => {
  response.sendFile(path.join(__dirname, '../../../public/index.html'));
};
